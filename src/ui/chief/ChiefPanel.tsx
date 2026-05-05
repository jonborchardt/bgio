// ChiefPanel (04.5) — the chief's per-turn UI for distributing resources to
// every non-chief seat and ending their phase.
//
// Renders nothing when:
//   - No `playerID` is bound to this client (spectator / unauthenticated), OR
//   - The local seat doesn't hold the `chief` role.
//
// During `chiefPhase` it shows the role header, one CircleEditor per
// non-chief seat (push or pull resources via `chiefDistribute`), and an
// "End my turn" button (`chiefEndPhase`). Outside `chiefPhase` the panel
// stays mounted but only renders the resource bar (income for the round)
// so the chief can watch their take accumulate; distribution UI is hidden.
//
// The panel surfaces a single chief action via <ChiefActionButton>,
// which morphs between "Flip Track" (when the round's track card is
// still face-down) and "End my turn" (after the flip lands or when
// the engine has no track). The handler dispatches `chiefFlipTrack`
// or `chiefEndPhase` accordingly. Resolve animation is driven by the
// resolve-animation provider — this panel only dispatches moves.

import { useCallback, useContext } from 'react';
import { Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { CircleEditor } from './CircleEditor.tsx';
import { ChiefActionButton } from './ChiefActionButton.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { PlayableHand } from '../cards/PlayableHand.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { firstNonChiefSeat } from '../layout/nextSeat.ts';
import { RequestsRow } from '../requests/RequestsRow.tsx';

export function ChiefPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  // Stable across renders so the `F` keyboard shortcut listener inside
  // <ChiefActionButton> doesn't unbind/rebind on every render — `moves`
  // is a fresh object each render, so without this wrap the effect's
  // deps would churn. Declared before the early returns so the hook
  // order is identical on every render (Rules of Hooks).
  const handleFlipTrack = useCallback((): void => {
    moves.chiefFlipTrack();
  }, [moves]);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  const isChiefSeat = localRoles.includes('chief');
  if (!isChiefSeat) return null;

  const isChiefPhase = ctx.phase === 'chiefPhase';
  const canPush = isChiefPhase;

  // Track slot may be absent (older fixtures); a missing track is
  // treated as "no flip required," matching `chiefEndPhase`'s own
  // behavior. The unified action button below switches its label /
  // handler off these flags.
  const hasTrack = G.track !== undefined;
  const flipped = G.track?.flippedThisRound === true;
  const upcomingCount = G.track?.upcoming.length ?? 0;

  // Sort seats deterministically; render every non-chief seat (the chief's
  // own seat owns no circle on the mat, so there's nothing to distribute to).
  const nonChiefSeats: PlayerID[] = Object.keys(G.roleAssignments)
    .filter((seat) => !rolesAtSeat(G.roleAssignments, seat).includes('chief'))
    .sort();

  const handlePush = (
    seat: PlayerID,
    resource: Resource,
    amount: number,
  ): void => {
    const amounts: Partial<ResourceBag> = { [resource]: amount };
    moves.chiefDistribute(seat, amounts);
  };

  const handleEndTurn = (): void => {
    moves.chiefEndPhase();
    if (seatCtx) seatCtx.setSeat(firstNonChiefSeat(G));
  };

  return (
    <RolePanel
      role="chief"
      connectedAbove
      actions={
        <>
          <GraveyardButton
            role="chief"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <UndoButton
            G={G}
            playerID={playerID}
            canAct={isChiefPhase}
            onUndo={() => moves.undoLast()}
          />
          {/* Single chief action: morphs from "Flip Track" to "End my
              turn" once the round's track card has been flipped. The
              button gates on the same `flippedThisRound` latch the move
              checks, so its mode mirrors what the engine will accept. */}
          {isChiefPhase ? (
            <ChiefActionButton
              canAct={isChiefPhase}
              hasTrack={hasTrack}
              flipped={flipped}
              upcomingCount={upcomingCount}
              onFlip={handleFlipTrack}
              onEnd={handleEndTurn}
            />
          ) : null}
        </>
      }
    >
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="chief" />

        <PlayableHand
          techs={G.chief?.hand ?? []}
          holderRole="chief"
          funds={G.bank}
          canAct={isChiefPhase}
          onPlay={(name) => moves.chiefPlayTech(name)}
          emptyHint="No gold tech cards yet — complete a gold science card to add one."
        />

        {isChiefPhase ? (
          <Stack spacing={1} aria-label="Send resources">
            <SectionHeading role="chief">Send Resources</SectionHeading>
            {nonChiefSeats.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                No non-chief seats to distribute to.
              </Typography>
            ) : (
              nonChiefSeats.map((seat) => {
                const mat = G.mats?.[seat];
                if (!mat) return null;
                return (
                  <CircleEditor
                    key={seat}
                    seat={seat}
                    roles={rolesAtSeat(G.roleAssignments, seat)}
                    inBag={mat.in}
                    bank={G.bank}
                    canPush={canPush}
                    onPush={(resource, amount) =>
                      handlePush(seat, resource, amount)
                    }
                  />
                );
              })
            )}
          </Stack>
        ) : null}

      </Stack>
    </RolePanel>
  );
}

export default ChiefPanel;
