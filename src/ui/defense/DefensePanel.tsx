// DefensePanel (1.4 stub) — the defense seat's per-turn UI.
//
// The full defense UI lands in Phase 3 (track strip, stack visualization,
// path overlay, HP pips, drill / teach indicators). For 1.4 the panel
// only renders:
//
//   - A "coming soon" message inside the role panel body, and
//   - An "End my turn" action that dispatches `defenseSeatDone`.
//
// Renders nothing when:
//   - No `playerID` is bound (spectator), OR
//   - The local seat doesn't hold the `defense` role.
//
// Stage gating: the seat-done button is enabled in `defenseTurn`. The
// `defenseSeatDone` move re-validates internally.

import { useContext } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { RolePanel } from '../layout/RolePanel.tsx';
import { GraveyardButton } from '../layout/GraveyardButton.tsx';
import { SeatPickerContext } from '../layout/SeatPickerContext.ts';
import { nextSeatAfterDone } from '../layout/nextSeat.ts';
import { RequestsRow } from '../requests/RequestsRow.tsx';
import { WanderEffectRow } from '../opponent/WanderEffectRow.tsx';

export function DefensePanel(props: BoardProps<SettlementState>) {
  const { G, ctx, moves, playerID } = props;
  const seatCtx = useContext(SeatPickerContext);

  if (playerID === undefined || playerID === null) return null;

  const localRoles = rolesAtSeat(G.roleAssignments, playerID);
  if (!localRoles.includes('defense')) return null;

  const stage = ctx.activePlayers?.[playerID];
  const canActOnTurn = stage === 'defenseTurn';
  const alreadyDone = G.othersDone?.[playerID] === true;

  const handleSeatDone = (): void => {
    moves.defenseSeatDone();
    if (seatCtx) seatCtx.setSeat(nextSeatAfterDone(G, playerID));
  };

  return (
    <RolePanel
      role="defense"
      connectedAbove
      topRow={<WanderEffectRow opponent={G.opponent} />}
      actions={
        <>
          <GraveyardButton
            role="defense"
            entries={G.graveyards?.[playerID] ?? []}
          />
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <Button
              variant="contained"
              disabled={!canActOnTurn || alreadyDone}
              onClick={handleSeatDone}
              aria-label="End my Defense turn"
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
      <Stack spacing={1.5}>
        <RequestsRow G={G} playerID={playerID} panelRole="defense" />

        <Typography
          variant="body2"
          sx={{
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            py: 2,
            textAlign: 'center',
          }}
        >
          Defense — coming in Phase 2.
        </Typography>
      </Stack>
    </RolePanel>
  );
}

export default DefensePanel;
