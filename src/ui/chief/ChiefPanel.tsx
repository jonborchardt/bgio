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
// Defense redesign 3.8 — the panel now also surfaces the round's
// **Flip Track** button (D22). Flipping is required before
// `chiefEndPhase` will resolve, so the End-my-phase button is disabled
// (with an inline reason) until the per-round latch
// `G.track.flippedThisRound` is set. The flip dispatches
// `chiefFlipTrack`; resulting strip / path overlay animation is driven
// by 3.1 + 3.3 — this panel just dispatches.

import { useContext } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { CircleEditor } from './CircleEditor.tsx';
import { FlipTrackButton } from './FlipTrackButton.tsx';
import { chiefEndPhaseDisabledReason } from './flipTrackLogic.ts';
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

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  const isChiefSeat = localRoles.includes('chief');
  if (!isChiefSeat) return null;

  const isChiefPhase = ctx.phase === 'chiefPhase';
  const canPush = isChiefPhase;

  // Defense redesign 3.8 — flip-first gate state (D22). The track slot
  // is optional on G (older fixtures may pre-date 2.2); we treat a
  // missing track as "flip gate not enforced," matching `chiefEndPhase`'s
  // own behavior.
  const hasTrack = G.track !== undefined;
  const flipped = G.track?.flippedThisRound === true;
  const upcomingCount = G.track?.upcoming.length ?? 0;

  const endPhaseReason = chiefEndPhaseDisabledReason({
    canAct: isChiefPhase,
    flipped,
    hasTrack,
  });
  const endPhaseDisabled = endPhaseReason !== null;

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

  const handleFlipTrack = (): void => {
    moves.chiefFlipTrack();
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
          {isChiefPhase ? (
            <Tooltip
              title={endPhaseReason ?? ''}
              disableHoverListener={!endPhaseDisabled}
            >
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <Button
                  variant="contained"
                  disabled={endPhaseDisabled}
                  onClick={handleEndTurn}
                  data-chief-end-phase-button="true"
                  data-chief-end-phase-disabled={
                    endPhaseDisabled ? 'true' : 'false'
                  }
                  sx={{
                    bgcolor: (t) => t.palette.role.chief.main,
                    color: (t) => t.palette.role.chief.contrastText,
                    '&:hover': {
                      bgcolor: (t) => t.palette.role.chief.dark,
                    },
                  }}
                >
                  End my turn
                </Button>
              </Box>
            </Tooltip>
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

        {isChiefPhase && hasTrack ? (
          <Stack spacing={0.75} aria-label="Flip track card">
            <SectionHeading role="chief">Flip Track</SectionHeading>
            <Typography
              variant="body2"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              The round's track card flips before you end your phase.
              The next card is face-up on the strip; flipping resolves it
              immediately and reveals the next telegraph.
            </Typography>
            <FlipTrackButton
              canAct={isChiefPhase}
              flipped={flipped}
              upcomingCount={upcomingCount}
              onFlip={handleFlipTrack}
            />
            {endPhaseDisabled && endPhaseReason !== null ? (
              <Typography
                variant="caption"
                data-chief-end-phase-error="true"
                sx={{ color: (t) => t.palette.status.critical }}
              >
                {endPhaseReason}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </RolePanel>
  );
}

export default ChiefPanel;
