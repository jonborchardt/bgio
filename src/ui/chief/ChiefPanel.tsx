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

import { useContext } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { computeBankView } from '../../game/resources/bankLog.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { CircleEditor } from './CircleEditor.tsx';
import { RolePanel } from '../layout/RolePanel.tsx';
import { StashBar } from '../resources/StashBar.tsx';
import { PlayableHand } from '../cards/PlayableHand.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { UndoButton } from '../layout/UndoButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { firstNonChiefSeat } from '../layout/nextSeat.ts';

export function ChiefPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  const isChiefSeat = localRoles.includes('chief');
  if (!isChiefSeat) return null;

  const isChiefPhase = ctx.phase === 'chiefPhase';
  const canPush = isChiefPhase;
  // Off-turn: show what the chief is collecting this round (income).
  // On-turn: show the full bank — everything available to distribute,
  // which is income + carryover combined.
  const barBag = isChiefPhase ? G.bank : computeBankView(G).income;
  const barLabel = isChiefPhase ? 'Stash' : 'Income';

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
            <Button
              variant="contained"
              disabled={!isChiefPhase}
              onClick={handleEndTurn}
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
          ) : null}
        </>
      }
    >
      <Stack spacing={1.5}>
        <StashBar
          stash={barBag}
          label={barLabel}
          ariaLabel={`Chief ${barLabel.toLowerCase()}`}
        />

        <PlayableHand
          techs={G.chief?.hand ?? []}
          holderRole="chief"
          funds={G.bank}
          canAct={isChiefPhase}
          onPlay={(name) => moves.chiefPlayTech(name)}
          emptyHint="No gold tech cards yet — complete a gold science card to add one."
        />

        {isChiefPhase ? (
          <Stack spacing={1} aria-label="Non-chief seats">
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
