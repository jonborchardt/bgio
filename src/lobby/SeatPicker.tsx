// SeatPicker (10.3) — role-binding UI bgio's stock lobby doesn't know
// about. Given `numPlayers`, we ask `assignRoles()` for the canonical
// seat -> roles table and render one MUI Button per seat, labeled with
// the role(s) that seat holds. Seats already taken are disabled.
//
// The actual REST `joinMatch` call is the parent's responsibility — this
// component is a pure picker. Parent passes `onJoin(seatID)` and then
// hands the `playerCredentials` returned by bgio back to whatever mounts
// the game `Client`.

import { Button, Stack, Typography } from '@mui/material';
import { assignRoles } from '../game/roles.ts';

export interface SeatPickerProps {
  /** Player count for the match — drives the role-assignment table. */
  numPlayers: 1 | 2 | 3 | 4;
  /** Map of seatID -> playerName (or null if empty). Disables the button when truthy. */
  occupied: Record<string, string | null>;
  /** Fired with the chosen seatID. Parent runs `lobby.joinMatch()` etc. */
  onJoin: (seatID: string) => void;
}

export function SeatPicker({ numPlayers, occupied, onJoin }: SeatPickerProps) {
  const seatToRoles = assignRoles(numPlayers);
  // Sort seat IDs numerically; assignRoles returns them as strings ('0', '1', …).
  const seats = Object.keys(seatToRoles).sort();

  return (
    <Stack
      component="section"
      aria-label="Seat picker"
      spacing={1}
      sx={{ width: '100%' }}
    >
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
      >
        Pick a seat
      </Typography>
      {seats.map((seatID) => {
        const roles = seatToRoles[seatID] ?? [];
        const taken = Boolean(occupied[seatID]);
        return (
          <Button
            key={seatID}
            variant="outlined"
            disabled={taken}
            onClick={() => onJoin(seatID)}
            sx={{
              justifyContent: 'flex-start',
              borderColor: (t) => t.palette.status.muted,
              color: (t) => t.palette.card.text,
              '&:hover': {
                borderColor: (t) => t.palette.status.active,
              },
            }}
          >
            {`seat ${seatID}: ${roles.join(', ')}`}
            {taken ? ' (taken)' : ''}
          </Button>
        );
      })}
    </Stack>
  );
}

export default SeatPicker;
