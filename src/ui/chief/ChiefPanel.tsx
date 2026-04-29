// ChiefPanel (04.5) — the chief's per-turn UI for distributing resources to
// every non-chief seat and ending their phase.
//
// Renders nothing when:
//   - No `playerID` is bound to this client (spectator / unauthenticated), OR
//   - The local seat doesn't hold the `chief` role, OR
//   - The engine isn't currently in `chiefPhase`.
//
// In all other cases it shows a header, a bank summary, one CircleEditor per
// non-chief seat (push +N gold via `chiefDistribute`), and an "End my turn"
// button (`chiefEndPhase`). The "End my turn" button is also rendered when
// the panel itself is visible, which by construction means the local seat is
// chief and we are in chiefPhase — so disabling it is theoretical, but we
// keep the disabled-state guard for symmetry with the plan's spec and to
// stay correct if the parent ever loosens the gating around the panel.
//
// All visual choices route through theme tokens (`palette.role.chief`,
// `palette.resource.gold`, …) — no raw hex literals.

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import {
  RESOURCES,
  type Resource,
  type ResourceBag,
} from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { CircleEditor } from './CircleEditor.tsx';

export function ChiefPanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;

  // Without a bound seat (spectator) we can't be the chief — render nothing.
  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  const isChiefSeat = localRoles.includes('chief');
  const isChiefPhase = ctx.phase === 'chiefPhase';

  // Panel is gated by "you are the chief AND it's your phase". The plan
  // notes "render nothing or a disabled-state notice"; we go with nothing
  // so the rest of the board stays uncluttered for non-chief seats.
  if (!isChiefSeat || !isChiefPhase) return null;

  const canPush = isChiefSeat && isChiefPhase;

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
  };

  // 14.4 — bank summary now shows every non-zero resource (with gold
  // always visible as the chief's canonical output) so the chief knows
  // what they can distribute.
  const bankResourcesShown: Resource[] = RESOURCES.filter(
    (r) => r === 'gold' || (G.bank[r] ?? 0) > 0,
  );

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.chief.main,
      }}
      aria-label="Chief panel"
    >
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: (t) => t.palette.role.chief.main,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          Chief
        </Typography>

        <Stack
          direction="row"
          spacing={1.5}
          aria-label="Bank summary"
          sx={{ alignItems: 'center' }}
        >
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Bank
          </Typography>
          {bankResourcesShown.map((resource) => (
            <Stack
              key={resource}
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center' }}
            >
              <Box
                aria-hidden
                sx={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  bgcolor: (t) => t.palette.resource[resource].main,
                }}
              />
              <Typography
                sx={{
                  color: (t) => t.palette.resource[resource].main,
                  fontWeight: 600,
                }}
              >
                {G.bank[resource] ?? 0}
              </Typography>
            </Stack>
          ))}
        </Stack>

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
              const circle = G.centerMat.circles[seat];
              if (!circle) return null;
              return (
                <CircleEditor
                  key={seat}
                  seat={seat}
                  circle={circle}
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

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            disabled={!isChiefSeat || !isChiefPhase}
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
        </Box>
      </Stack>
    </Paper>
  );
}

export default ChiefPanel;
