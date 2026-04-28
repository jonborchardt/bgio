// RoleSlot (09.1) — wrapper that flips between expanded and collapsed render
// modes for one of the four role panels. The parent (Board.tsx) decides
// expansion based on whether the local seat holds the role.
//
// V1 keeps the collapse mode optional: when no `summary` is supplied, the
// slot renders nothing in collapsed mode (so the layout shell doesn't need
// every role's mini-summary on day one).

import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export interface RoleSlotProps {
  expanded?: boolean;
  children: ReactNode;
  summary?: ReactNode;
}

export function RoleSlot({ expanded, children, summary }: RoleSlotProps) {
  if (expanded === true) return <Box>{children}</Box>;
  if (summary !== undefined) return <Box>{summary}</Box>;
  return null;
}

export default RoleSlot;
