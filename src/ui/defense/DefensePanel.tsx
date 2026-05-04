// Defense redesign 3.6 — DefensePanel rewrite.
//
// Replaces the post-1.4 stub panel with the full Defense UI:
//
//   - Stash bar reminder (read off `G.mats[seat].stash`).
//   - Telegraphed next-card hint (so the seat can plan from the panel
//     without scrolling up to the TrackStrip).
//   - Unit hand (the `G.defense.hand` row + buy-and-place flow).
//   - PlacementOverlay shown when a unit is armed; clicking a target
//     dispatches `defenseBuyAndPlace(unitDefID, cellKey)`.
//   - Red tech hand (the `G.defense.techHand` row, played via
//     `defensePlay(techName)`).
//   - In-play list — every unit currently on the grid, with drill /
//     taught-skill markers (mirrors UnitStack tooltip text in 3.2).
//   - End-my-turn action.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `defense` role.
//
// State the panel reads off props:
//   - `G.defense`               — hand / techHand / inPlay
//   - `G.mats[playerID].stash`  — affordability gate
//   - `G.domestic?.grid`        — placement targets
//   - `G.track?.upcoming[0]`    — telegraphed next card
//   - `ctx.activePlayers[playerID]` — `defenseTurn` gate
//   - `G.othersDone[playerID]`  — once-per-round latch

import { useContext, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { RolePanel } from '../layout/RolePanel.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForUnit, idForTech } from '../../cards/registry.ts';
import { unitCost } from '../../data/index.ts';
import { UnitHand } from './UnitHand.tsx';
import { PlacementOverlay } from './PlacementOverlay.tsx';
import { TechRow } from './TechRow.tsx';
import { InPlayList } from './InPlayList.tsx';

export function DefensePanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  // Hooks must run unconditionally — hold per-panel state above the
  // early-return guards so the hidden-panel branch doesn't break the
  // rules-of-hooks invariant.
  const [selectedUnitName, setSelectedUnitName] = useState<
    string | undefined
  >(undefined);

  // Telegraphed next-card hint. Recomputed off `G.track` so the panel
  // mirrors the TrackStrip's "next" slot exactly.
  const nextCard = useMemo(
    () => G.track?.upcoming?.[0],
    [G.track],
  );

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('defense')) return null;

  const stage = ctx.activePlayers?.[playerID];
  const canActOnTurn = stage === 'defenseTurn';
  const alreadyDone = G.othersDone?.[playerID] === true;
  const canAct = canActOnTurn && !alreadyDone;

  const stash = G.mats?.[playerID]?.stash ?? { ...EMPTY_BAG };
  const defense = G.defense;
  const grid = G.domestic?.grid ?? {};

  const hand = defense?.hand ?? [];
  const techHand = defense?.techHand ?? [];
  const inPlay = defense?.inPlay ?? [];

  const handleSelectUnit = (name: string): void => {
    setSelectedUnitName((prev) => (prev === name ? undefined : name));
  };

  const handleCancelPlacement = (): void => {
    setSelectedUnitName(undefined);
  };

  const handlePickCell = (cellKey: string): void => {
    if (selectedUnitName === undefined) return;
    moves.defenseBuyAndPlace(selectedUnitName, cellKey);
    // Clear selection after dispatch — the move is single-use; even on
    // INVALID_MOVE the user can re-arm by clicking the card again.
    setSelectedUnitName(undefined);
  };

  const handlePlayTech = (techName: string): void => {
    moves.defensePlay(techName);
  };

  const handleSeatDone = (): void => {
    moves.defenseSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  // Telegraphed-next summary line. Mirrors the per-card printable
  // description that TrackCardView shows but compresses to a single
  // line so the panel doesn't reproduce the whole card.
  const nextHint = (() => {
    if (nextCard === undefined) return 'No card telegraphed (track empty).';
    if (nextCard.kind === 'threat') {
      return `${nextCard.name} — ${nextCard.direction} ${
        nextCard.offset >= 0 ? `+${nextCard.offset}` : nextCard.offset
      }, str ${nextCard.strength}`;
    }
    if (nextCard.kind === 'boss') {
      return `${nextCard.name} — boss (sci ${nextCard.thresholds.science}, eco ${nextCard.thresholds.economy}, mil ${nextCard.thresholds.military})`;
    }
    return `${nextCard.name} — ${nextCard.kind}`;
  })();

  return (
    <RolePanel
      role="defense"
      connectedAbove
      actions={
        <>
          <GraveyardButton
            role="defense"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <UndoButton
            G={G}
            playerID={playerID}
            canAct={canAct}
            onUndo={() => moves.undoLast()}
          />
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <Button
              variant="contained"
              disabled={!canActOnTurn || alreadyDone}
              onClick={handleSeatDone}
              aria-label="End my Defense turn"
              data-defense-end-turn="true"
              sx={{
                bgcolor: (t) => t.palette.role.defense.main,
                color: (t) => t.palette.role.defense.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.defense.dark,
                },
              }}
            >
              {alreadyDone ? 'Turn ended' : 'End my turn'}
            </Button>
          </Box>
        </>
      }
    >
      <Stack spacing={1.5} data-defense-panel="true">
        <RequestsRow G={G} playerID={playerID} panelRole="defense" />

        {/* Telegraphed next-card hint — the panel-local readout so the
            seat can plan their buy / placement without scrolling up to
            the global TrackStrip. */}
        <Box
          data-defense-next-hint="true"
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            border: '1px dashed',
            borderColor: (t) => t.palette.role.defense.dark,
            bgcolor: (t) => t.palette.card.surface,
          }}
        >
          <Typography
            variant="overline"
            sx={{
              color: (t) => t.palette.role.defense.light,
              fontWeight: 700,
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            Next card (telegraphed)
          </Typography>
          <Typography
            variant="body2"
            data-defense-next-hint-text="true"
            sx={{ color: (t) => t.palette.role.defense.contrastText }}
          >
            {nextHint}
          </Typography>
        </Box>

        <SectionHeading role="defense">Hand</SectionHeading>
        <UnitHand
          hand={hand}
          stash={stash}
          canAct={canAct}
          selectedName={selectedUnitName}
          onSelect={handleSelectUnit}
        />

        {/* PlacementOverlay only renders when a unit is armed. */}
        <PlacementOverlay
          selectedUnitName={selectedUnitName}
          grid={grid}
          units={inPlay}
          onPick={handlePickCell}
          onCancel={handleCancelPlacement}
        />

        <SectionHeading role="defense">Tech</SectionHeading>
        <TechRow
          techs={techHand}
          funds={stash}
          canAct={canAct}
          onPlay={handlePlayTech}
          renderHelpButton={(tech) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="defense"
              targetId={idForTech(tech)}
              targetLabel={tech.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'defense',
                cost: tech.costBag ?? {},
                have: stash,
              })}
            />
          )}
        />

        {/* Help-request row for unaffordable units in the hand. The
            UnitHand renders the cards themselves; this stack surfaces a
            help button for each unit that the seat can't currently
            afford so the chief can route resources their way. */}
        {hand.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            data-defense-hand-helprow="true"
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {hand.map((def) => (
              <RequestHelpButton
                key={`help-${def.name}`}
                G={G}
                playerID={playerID}
                moves={moves}
                fromRole="defense"
                targetId={idForUnit(def)}
                targetLabel={def.name}
                slices={buildResourceSlices({
                  G,
                  fromSeat: playerID,
                  fromRole: 'defense',
                  cost: unitCost(def),
                  have: stash,
                })}
              />
            ))}
          </Stack>
        ) : null}

        <SectionHeading role="defense">In play ({inPlay.length})</SectionHeading>
        <InPlayList units={inPlay} />
      </Stack>
    </RolePanel>
  );
}

export default DefensePanel;
