// SciencePanel (05.5) — the science seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `science` role, OR
//   - `G.science` is missing (legacy fixtures that pre-date 05.1).
//
// Otherwise we draw the 3×4 grid (4 colors × 3 tiers). For each cell we
// compute the "lowest unfinished card in that color column" — only that
// card may receive contributions or be completed (the lowest-first rule
// enforced by `scienceContribute` / `scienceComplete`). Higher-level cards
// in the same column are dimmed inside `ScienceCard`.
//
// Contribute and Complete buttons are gated additionally on the science
// seat being in the `scienceTurn` stage (`ctx.activePlayers?.[playerID]`).
// The completion button also requires `paid >= cost` and that the seat
// hasn't already used its one-completion-per-round allowance.

import { useContext } from 'react';
import { Box, Button, Stack } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import type {
  Resource,
  ResourceBag,
} from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import type { ScienceCardDef } from '../../data/scienceCards.ts';
import { ScienceCard } from './ScienceCard.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { PlayableHand } from '../cards/PlayableHand.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForScience, idForTech } from '../../cards/registry.ts';

export function SciencePanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('science')) return null;

  const science = G.science;
  if (science === undefined) return null;

  const stash = G.mats?.[playerID]?.stash ?? { ...EMPTY_BAG };

  const canAct = ctx.activePlayers?.[playerID] === 'scienceTurn';
  const completionsLeft = science.perRoundCompletions < 1;
  // 14.13 — once the seat flips its done flag (via scienceSeatDone),
  // the End-my-turn button should reflect that. Re-clicking is a
  // no-op but the unchanged UI gave no feedback.
  const alreadyDone = G.othersDone?.[playerID] === true;

  // For a given card, find the lowest-level non-completed card in its color
  // column. The cell's card matches → it's the legal contribute/complete
  // target. Mirrors the rule encoded in scienceContribute.
  const lowestCardIDByColor = new Map<string, string | null>();
  for (const column of science.grid) {
    if (column.length === 0) continue;
    const color = column[0]!.color;
    let best: ScienceCardDef | undefined;
    for (const c of column) {
      if (science.completed.includes(c.id)) continue;
      if (best === undefined || c.level < best.level) best = c;
    }
    lowestCardIDByColor.set(color, best?.id ?? null);
  }

  const handleContribute = (
    cardID: string,
    resource: Resource,
    amount: number,
  ): void => {
    const amounts: Partial<ResourceBag> = { [resource]: amount };
    moves.scienceContribute(cardID, amounts);
  };

  const handleComplete = (cardID: string): void => {
    moves.scienceComplete(cardID);
  };

  const handleSeatDone = (): void => {
    moves.scienceSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  // Visualize as columns side-by-side. Each column = one color, with row 0
  // (lowest tier) at the top.
  return (
    <RolePanel
      role="science"
      connectedAbove
      actions={
        <>
          <GraveyardButton
            role="science"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <UndoButton
            G={G}
            playerID={playerID}
            canAct={canAct && !alreadyDone}
            onUndo={() => moves.undoLast()}
          />
          <Button
            variant="contained"
            disabled={!canAct || alreadyDone}
            onClick={handleSeatDone}
            aria-label="End my Science turn"
            sx={{
              bgcolor: (t) => t.palette.role.science.main,
              color: (t) => t.palette.role.science.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.science.dark,
              },
            }}
          >
            {alreadyDone ? 'Turn ended' : 'End my turn'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="science" />

        <PlayableHand
          techs={science.hand}
          holderRole="science"
          funds={stash}
          canAct={canAct && !alreadyDone}
          onPlay={(name) => moves.sciencePlayTech(name)}
          emptyHint="No blue tech cards yet — complete a blue science card to add one."
          renderHelpButton={(tech) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="science"
              targetId={idForTech(tech)}
              targetLabel={tech.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'science',
                cost: tech.costBag ?? {},
                have: stash,
              })}
            />
          )}
        />

        <SectionHeading role="science">Research Areas</SectionHeading>
        <Box
          aria-label="Research areas"
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${science.grid.length}, minmax(8rem, 1fr))`,
            gap: 0.75,
            overflowX: 'auto',
            pb: 0.5,
          }}
        >
          {science.grid.map((column, ci) => (
            <Stack
              key={`col-${ci}`}
              spacing={1}
              aria-label={
                column[0] ? `Science column ${column[0].color}` : `Science column ${ci}`
              }
            >
              {column.map((card) => {
                const isCompleted = science.completed.includes(card.id);
                const isLowest =
                  !isCompleted &&
                  lowestCardIDByColor.get(card.color) === card.id;
                const paid = science.paid[card.id] ?? {
                  gold: 0,
                  wood: 0,
                  stone: 0,
                  steel: 0,
                  horse: 0,
                  food: 0,
                  production: 0,
                  science: 0,
                  happiness: 0,
                  worker: 0,
                };
                const completable =
                  canAct &&
                  completionsLeft &&
                  !isCompleted &&
                  canAfford(paid, card.cost);

                // Pick the most informative reason the Complete button is
                // disabled so ScienceCard can surface it as a tooltip.
                // Order matters: the per-round cap comes BEFORE
                // affordability so a seat that's already used their one
                // completion sees the cap message rather than a generic
                // "pay first" hint when they happen to also be short on
                // resources. `!isLowest` and `isCompleted` are surfaced
                // visually elsewhere (dimmed card body), so we don't
                // double-narrate them here.
                let completionDisabledReason: string | undefined;
                if (!canAct) {
                  completionDisabledReason = "Wait for Science's turn.";
                } else if (!isCompleted && !completionsLeft) {
                  completionDisabledReason =
                    'Already completed a science card this round — only one per round.';
                } else if (!isCompleted && !canAfford(paid, card.cost)) {
                  completionDisabledReason =
                    'Pay the full cost first (contribute resources below).';
                }

                const underTechs = science.underCards[card.id] ?? [];
                // Compute "what does science need the chief to send?" =
                // (cost - paid - stash), clamped non-negative. Anything
                // already paid is on the card, anything in stash the
                // seat can contribute themselves; only the residual
                // belongs in the ask.
                const remaining: Partial<ResourceBag> = {};
                for (const r of Object.keys(card.cost) as Array<keyof typeof card.cost>) {
                  const need =
                    (card.cost[r] ?? 0) - (paid[r] ?? 0) - (stash[r] ?? 0);
                  if (need > 0) remaining[r as Resource] = need;
                }
                const helpSlices =
                  isCompleted || !isLowest
                    ? []
                    : buildResourceSlices({
                        G,
                        fromSeat: playerID,
                        fromRole: 'science',
                        cost: remaining,
                        have: { ...EMPTY_BAG },
                      });
                return (
                  <ScienceCard
                    key={card.id}
                    card={card}
                    paid={paid}
                    stash={stash}
                    canAct={canAct && !isCompleted}
                    canComplete={completable}
                    completionDisabledReason={completionDisabledReason}
                    isLowest={isLowest}
                    underTechs={underTechs}
                    onContribute={(resource, amount) =>
                      handleContribute(card.id, resource, amount)
                    }
                    onComplete={() => handleComplete(card.id)}
                    helpButton={
                      <RequestHelpButton
                        G={G}
                        playerID={playerID}
                        moves={moves}
                        fromRole="science"
                        targetId={idForScience(card)}
                        targetLabel={`${card.color} L${card.level}`}
                        slices={helpSlices}
                      />
                    }
                  />
                );
              })}
            </Stack>
          ))}
        </Box>
      </Stack>
    </RolePanel>
  );
}

export default SciencePanel;
