// SciencePanel — the science seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `science` role, OR
//   - `G.science` is missing.
//
// Hosts the seat's full action surface: the 6-slot `LibraryRow`
// (buy / burn), the per-seat `DiscountTableau`, the Drill / Teach
// moves, the blue-tech `PlayableHand`, and the End-my-turn / Undo /
// Graveyard chrome.

import { useContext } from 'react';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { DrillButton } from './DrillButton.tsx';
import { TeachButton } from './TeachDialog.tsx';
import { drillCost } from '../../game/roles/science/drill.ts';
import type { SkillID } from '../../game/roles/science/skills.ts';
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
import { idForTech } from '../../cards/registry.ts';
import { DiscountTableau } from '../library/DiscountTableau.tsx';
import { LibraryRow } from '../library/LibraryRow.tsx';

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
  // 14.13 — once the seat flips its done flag (via scienceSeatDone),
  // the End-my-turn button should reflect that. Re-clicking is a
  // no-op but the unchanged UI gave no feedback.
  const alreadyDone = G.othersDone?.[playerID] === true;
  // Library burns are mandatory each round — the seat can't end its
  // turn until they've burned at least one card.
  const burnedThisRound = science.scienceBurnedThisRound === true;
  const endTurnDisabled = !canAct || alreadyDone || !burnedThisRound;
  const endTurnReason = alreadyDone
    ? null
    : !canAct
      ? "Wait for Science's turn."
      : !burnedThisRound
        ? 'Burn at least one card before ending your turn.'
        : null;

  const tableau = G.library?.discountTableaus[playerID] ?? [];

  const handleSeatDone = (): void => {
    moves.scienceSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  // Defense redesign 3.7 — Drill / Teach handlers and the inputs the
  // sub-components need to compute their disabled / status state.
  const handleDrill = (unitID: string): void => {
    moves.scienceDrill(unitID);
  };

  const handleTeach = (unitID: string, skillID: SkillID): void => {
    moves.scienceTeach(unitID, skillID);
  };

  const handleLibraryBuy = (slotIndex: number): void => {
    moves.scienceLibraryBuy(slotIndex);
  };
  const handleLibraryBurn = (slotIndex: number): void => {
    moves.scienceLibraryBurn(slotIndex);
  };

  const inPlayUnits = G.defense?.inPlay ?? [];
  const drillUsed = science.scienceDrillUsed === true;
  const taughtUsed = science.scienceTaughtUsed === true;
  const stashScience = stash.science ?? 0;
  const drillCostScience = drillCost(G).science;

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
          <Tooltip title={endTurnReason ?? ''} disableHoverListener={endTurnReason === null}>
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                disabled={endTurnDisabled}
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
            </Box>
          </Tooltip>
        </>
      }
    >
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="science" />

        {G.library !== undefined ? (
          <Stack spacing={0.75} aria-label="Library">
            <SectionHeading role="science">Library</SectionHeading>
            <LibraryRow
              library={G.library}
              viewerSeat={playerID}
              viewerIsScience={true}
              canAct={canAct && !alreadyDone}
              viewerStash={stash}
              onBuy={handleLibraryBuy}
              onBurn={handleLibraryBurn}
            />
          </Stack>
        ) : null}

        <Stack
          spacing={0.75}
          aria-label="Science moves"
          data-science-moves="true"
        >
          <SectionHeading role="science">Science moves</SectionHeading>
          <Stack
            direction="row"
            spacing={2}
            sx={{ flexWrap: 'wrap', rowGap: 1 }}
          >
            <DrillButton
              units={inPlayUnits}
              canAct={canAct && !alreadyDone}
              drillUsed={drillUsed}
              stashScience={stashScience}
              drillCost={drillCostScience}
              onDrill={handleDrill}
            />
            <TeachButton
              units={inPlayUnits}
              canAct={canAct && !alreadyDone}
              taughtUsed={taughtUsed}
              stashScience={stashScience}
              onTeach={handleTeach}
            />
          </Stack>
        </Stack>

        <PlayableHand
          techs={science.hand}
          holderRole="science"
          funds={stash}
          canAct={canAct && !alreadyDone}
          onPlay={(name) => moves.sciencePlayTech(name)}
          emptyHint="No blue tech cards yet — buy a blue card from the Library to add one."
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

        <Stack spacing={0.75} aria-label="My discounts">
          <SectionHeading role="science">My discounts</SectionHeading>
          <DiscountTableau tableau={tableau} seat={playerID} />
        </Stack>
      </Stack>
    </RolePanel>
  );
}

export default SciencePanel;
