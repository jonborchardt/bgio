// DomesticPanel — the domestic seat's per-turn UI.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `domestic` role, OR
//   - `G.domestic` is missing (legacy fixtures pre-06.1).
//
// Otherwise we render:
//   1. <Hand> — building cards available to buy and place. Clicking a
//      card publishes the selection into `VillagePlacementContext`.
//   2. A placement-prompt caption while a card is armed — the actual
//      grid lives at the board level (post-3.9 preference sweep) so
//      every seat watches the same village + threat-resolve overlay.
//      Clicking a legal empty cell on the board's grid fires
//      `domesticBuyBuilding(name, x, y)` from there and clears the
//      armed selection.
//
// Production is automatic: it fires at `othersPhase.turn.onBegin` for
// every seat that holds the domestic role, before the seat acts. There's
// no decision in produce, so there's no button.

import { useContext } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { Hand } from './Hand.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { VillagePlacementContext } from '../layout/VillagePlacementContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestHelpButton } from '../requests/RequestHelpButton.tsx';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { buildResourceSlices } from '../requests/useResourceSlice.ts';
import { idForBuilding, idForTech } from '../../cards/registry.ts';
import { buildingCost } from '../../data/index.ts';

export function DomesticPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);
  // Post-3.9 preference sweep — placement state lives on the board so
  // every seat watches the same lifted BuildingGrid. The panel reads
  // the selection here (to highlight the armed card in the hand) and
  // writes via setSelectedBuildingName when the player clicks a card.
  const placement = useContext(VillagePlacementContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('domestic')) return null;

  const domestic = G.domestic;
  if (domestic === undefined) return null;

  const canAct = ctx.activePlayers?.[playerID] === 'domesticTurn';
  // 14.13 — disable + relabel End-my-turn after the seat flips done.
  const alreadyDone = G.othersDone?.[playerID] === true;

  const selectedCardName = placement.selectedBuildingName;

  const handleSelect = (name: string): void => {
    placement.setSelectedBuildingName(
      selectedCardName === name ? undefined : name,
    );
  };

  const handleSeatDone = (): void => {
    moves.domesticSeatDone();
    placement.setSelectedBuildingName(undefined);
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  // The hand IS the source of truth for "what this seat can build" —
  // buildings are added to it by setup (starters), by `grantTechUnlocks`
  // when a tech is played, and (later) by other card-spawning effects.
  // The previous "Requires X" UI filter was a second gate on top of that
  // and hid most of the hand because the requirement text often listed
  // multiple prereqs (e.g. Library "Requires Library (tech) + Reading"),
  // any one of which being unsatisfied dropped the card. The engine
  // already controls which buildings reach the hand; the UI just
  // renders the hand directly.
  const visibleHand = domestic.hand;

  return (
    <RolePanel
      role="domestic"
      connectedAbove
      actions={
        <>
          <GraveyardButton
            role="domestic"
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
            aria-label="End my Domestic turn"
            sx={{
              bgcolor: (t) => t.palette.role.domestic.main,
              color: (t) => t.palette.role.domestic.contrastText,
              '&:hover': {
                bgcolor: (t) => t.palette.role.domestic.dark,
              },
            }}
          >
            {alreadyDone ? 'Turn ended' : 'End my turn'}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="domestic" />

        <Hand
          hand={visibleHand}
          techs={domestic.techHand ?? []}
          canAct={canAct && !alreadyDone}
          onPlayTech={(name) => moves.domesticPlayTech(name)}
          selectedName={selectedCardName}
          onSelect={handleSelect}
          stash={G.mats?.[playerID]?.stash}
          emptyHint="No buildings unlocked yet — complete a green science card to gain Civic techs that enable buildings."
          renderBuildingHelp={(def) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="domestic"
              targetId={idForBuilding(def)}
              targetLabel={def.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'domestic',
                cost: buildingCost(def),
                have: G.mats?.[playerID]?.stash,
              })}
            />
          )}
          renderTechHelp={(tech) => (
            <RequestHelpButton
              G={G}
              playerID={playerID}
              moves={moves}
              fromRole="domestic"
              targetId={idForTech(tech)}
              targetLabel={tech.name}
              slices={buildResourceSlices({
                G,
                fromSeat: playerID,
                fromRole: 'domestic',
                cost: tech.costBag ?? {},
                have: G.mats?.[playerID]?.stash,
              })}
            />
          )}
        />

        {selectedCardName !== undefined ? (
          <Box data-domestic-place-prompt="true">
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.role.domestic.light }}
            >
              Click a legal cell in the village above to place{' '}
              {selectedCardName}, or click the hand card again to cancel.
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </RolePanel>
  );
}

export default DomesticPanel;
