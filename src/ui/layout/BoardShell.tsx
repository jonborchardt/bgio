// BoardShell (09.1) — the board's outer skeleton.
//
// Layout (CSS grid template areas):
//   ┌──────────────── chief ────────────────┐
//   │ science │   centerMat   │   domestic  │
//   │         │               │             │
//   │         │   foreign     │             │
//   └─────────────── status ────────────────┘
//
// The shell is purely structural — it places nodes; it does not pick which
// role is expanded vs collapsed. Board.tsx wraps each role child in a
// RoleSlot before injecting it here.

import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export interface BoardShellProps {
  chief: ReactNode;
  science: ReactNode;
  domestic: ReactNode;
  foreign: ReactNode;
  centerMat: ReactNode;
  status: ReactNode;
}

export function BoardShell({
  chief,
  science,
  domestic,
  foreign,
  centerMat,
  status,
}: BoardShellProps) {
  return (
    <Box
      aria-label="Board shell"
      sx={{
        display: 'grid',
        gap: 2,
        width: '100%',
        gridTemplateColumns: '1fr 2fr 1fr',
        gridTemplateAreas: `
          "chief    chief     chief"
          "science  centerMat domestic"
          "science  foreign   domestic"
          "status   status    status"
        `,
      }}
    >
      <Box sx={{ gridArea: 'chief' }}>{chief}</Box>
      <Box sx={{ gridArea: 'science' }}>{science}</Box>
      <Box sx={{ gridArea: 'centerMat' }}>{centerMat}</Box>
      <Box sx={{ gridArea: 'foreign' }}>{foreign}</Box>
      <Box sx={{ gridArea: 'domestic' }}>{domestic}</Box>
      <Box sx={{ gridArea: 'status' }}>{status}</Box>
    </Box>
  );
}

export default BoardShell;
