// SeatPicker (14.1) — sticky tab strip that lets the hot-seat user pick
// which seat they're currently driving. Without this, the GH Pages
// build mounts `Client({...})` with no `playerID` (or a fixed `'0'`)
// and every non-chief role panel returns null because the local seat
// doesn't hold that role — the demo is un-playable from a single tab.
//
// The picker has two render modes:
//   - editable (`onChange` provided, hot-seat mode) — one MUI Tab per
//     seat. Active tab uses the seat's role as a color accent so a
//     glance at the strip mirrors the role panels' borders.
//   - read-only (`onChange` undefined, networked mode) — a small badge
//     reading "You are Player N: <roles>". The lobby (10.3) is the
//     authority on which seat you hold; the picker just surfaces it.
//
// Multi-role seats (1-3p games) list every role in the label so the
// label reads as "Player 1: chief, science" — the same string used by
// the role-assignments banner that already lives above the shell.

import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import type { PlayerID, Role } from '../../game/types.ts';

export interface SeatPickerProps {
  numPlayers: 1 | 2 | 3 | 4;
  current: PlayerID;
  roleAssignments: Record<PlayerID, Role[]>;
  /** When undefined, the picker renders read-only (networked mode). When
   *  provided, switching tabs invokes this callback with the new seat id. */
  onChange?: (seat: PlayerID) => void;
}

// Priority used to pick a single accent color for a seat that holds
// more than one role. Mirrors `NON_CHIEF_PRIORITY` in
// `src/game/phases/stages.ts` but keeps `chief` first so 2-player games
// (where seat 0 holds chief+science) still read as a chief seat.
const ROLE_ACCENT_PRIORITY: ReadonlyArray<Role> = [
  'chief',
  'science',
  'domestic',
  'foreign',
];

const accentRoleFor = (roles: ReadonlyArray<Role>): Role | undefined =>
  ROLE_ACCENT_PRIORITY.find((r) => roles.includes(r));

export function SeatPicker({
  current,
  roleAssignments,
  onChange,
}: SeatPickerProps) {
  const seats = Object.keys(roleAssignments).sort();
  const currentRoles = roleAssignments[current] ?? [];
  const currentAccent = accentRoleFor(currentRoles);

  if (onChange === undefined) {
    // Read-only badge for networked mode.
    return (
      <Paper
        elevation={0}
        aria-label="Seat indicator"
        sx={{
          px: 2,
          py: 1,
          bgcolor: (t) => t.palette.card.surface,
          border: '1px solid',
          borderColor: (t) =>
            currentAccent
              ? t.palette.role[currentAccent].main
              : t.palette.status.muted,
          borderRadius: 1,
          alignSelf: 'center',
          width: 'fit-content',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            You are
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              color: (t) =>
                currentAccent
                  ? t.palette.role[currentAccent].main
                  : undefined,
            }}
          >
            Player {Number(current) + 1}
            {currentRoles.length > 0 ? `: ${currentRoles.join(', ')}` : ''}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box aria-label="Seat picker">
      <Tabs
        value={current}
        onChange={(_e: unknown, v: string) => onChange(v as PlayerID)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTabs-indicator': {
            bgcolor: (t) =>
              currentAccent
                ? t.palette.role[currentAccent].main
                : undefined,
          },
        }}
      >
        {seats.map((seat) => {
          const roles = roleAssignments[seat] ?? [];
          const accent = accentRoleFor(roles);
          const label =
            roles.length > 0
              ? `Player ${Number(seat) + 1}: ${roles.join(', ')}`
              : `Player ${Number(seat) + 1}`;
          return (
            <Tab
              key={seat}
              value={seat}
              label={label}
              aria-label={`Switch to ${label}`}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': {
                  color: (t) =>
                    accent ? t.palette.role[accent].main : undefined,
                },
              }}
            />
          );
        })}
      </Tabs>
    </Box>
  );
}

export default SeatPicker;
