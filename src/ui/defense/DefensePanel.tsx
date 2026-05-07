// Defense redesign 3.6 — DefensePanel.
//
// The defense seat's per-turn UI:
//
//   - Stash bar reminder (read off `G.mats[seat].stash`).
//   - Unit hand (the `G.defense.hand` row + selection flow), with a
//     per-card help-request button next to each unit's Buy & place
//     action.
//   - Red tech hand (the `G.defense.techHand` row, played via
//     `defensePlay(techName)`).
//   - End-my-turn action.
//
// Post-3.9 preference sweep: the village grid was lifted out of this
// panel into the board-level layout so every seat watches the same
// map + attack animations. The defense seat publishes its armed unit
// into `VillagePlacementContext`, and the board-mounted BuildingGrid
// reads it to highlight legal target tiles. Click on a tile dispatches
// `defenseBuyAndPlace` from the board (which clears the selection).
// In-play unit state lives on the village grid itself (UnitStack on
// each tile) — the panel doesn't duplicate it.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `defense` role.

import { useContext } from 'react';
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
import { VillagePlacementContext } from '../layout/VillagePlacementContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForUnit, idForTech } from '../../cards/registry.ts';
import { unitCost } from '../../data/index.ts';
import { UnitHand } from './UnitHand.tsx';
import { TechRow } from './TechRow.tsx';

export function DefensePanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);
  // Post-3.9 preference sweep — placement state lives on the board so
  // every seat watches the same lifted BuildingGrid. The panel reads
  // selectedUnitName here (to highlight the armed card in the hand)
  // and writes via setSelectedUnitName when the player clicks a card.
  const placement = useContext(VillagePlacementContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('defense')) return null;

  const stage = ctx.activePlayers?.[playerID];
  const canActOnTurn = stage === 'defenseTurn';
  const alreadyDone = G.othersDone?.[playerID] === true;
  const canAct = canActOnTurn && !alreadyDone;

  const stash = G.mats?.[playerID]?.stash ?? { ...EMPTY_BAG };
  const defense = G.defense;

  const hand = defense?.hand ?? [];
  const techHand = defense?.techHand ?? [];

  const selectedUnitName = placement.selectedUnitName;

  const handleSelectUnit = (name: string): void => {
    placement.setSelectedUnitName(
      selectedUnitName === name ? undefined : name,
    );
  };

  const handlePlayTech = (techName: string): void => {
    moves.defensePlay(techName);
  };

  const handleSeatDone = (): void => {
    moves.defenseSeatDone();
    placement.setSelectedUnitName(undefined);
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

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

        <SectionHeading role="defense">Hand</SectionHeading>
        <UnitHand
          hand={hand}
          stash={stash}
          canAct={canAct}
          selectedName={selectedUnitName}
          onSelect={handleSelectUnit}
          renderHelpButton={(def) => (
            <RequestHelpButton
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
          )}
        />

        {/* Placement prompt — the village grid lives at the board
            level (same component every seat watches), so when a unit
            is armed we just nudge the player to click on the map
            above. The grid handles highlighting + the click
            dispatch. */}
        {selectedUnitName !== undefined ? (
          <Box data-defense-place-prompt="true">
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.role.defense.light }}
            >
              Click a building tile in the village above to station{' '}
              {selectedUnitName}, or click the unit card again to cancel.
            </Typography>
          </Box>
        ) : null}

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
      </Stack>
    </RolePanel>
  );
}

export default DefensePanel;
