// RolePanel — shared shell for the four role panels (chief / science /
// domestic / foreign). Owns the Paper container, role-themed border,
// and an optional right-aligned action row, so each panel only has to
// provide its body content. The role name is no longer rendered here:
// the panel sits beneath its seat tile (which already labels the role
// in the tab header), so a duplicate `<h2>Chief</h2>` was redundant.

import { Box, Paper, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export type RoleName = 'chief' | 'science' | 'domestic' | 'foreign';

const ROLE_TITLES: Record<RoleName, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

export interface RolePanelProps {
  role: RoleName;
  actions?: ReactNode;
  /** Optional content rendered inside the panel above the actions row.
   *  Used for cross-cutting status that should sit higher than the role's
   *  own action affordances (e.g. the wander effect row). */
  topRow?: ReactNode;
  children: ReactNode;
  /** When true, the panel renders as the active tab's content — its top
   *  border + top corners square off so the selected Circle tile above
   *  it can fuse into a single bordered shape. Board sets this when the
   *  local seat holds this role (i.e. this panel sits under the
   *  highlighted seat tile). */
  connectedAbove?: boolean;
}

export function RolePanel({
  role,
  actions,
  topRow,
  children,
  connectedAbove,
}: RolePanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        // Top rail is always drawn — when fused with a seat tile above,
        // the tile sits on top with `mb:-1px` and its own bg, hiding
        // the rail under itself so the seam reads as a tabbed UI
        // (rail visible under unselected tabs, gap under the selected
        // tab where its bg punches through).
        border: '2px solid',
        borderColor: (t) => t.palette.role[role].main,
        borderTopLeftRadius: connectedAbove ? 0 : undefined,
        borderTopRightRadius: connectedAbove ? 0 : undefined,
      }}
      aria-label={`${ROLE_TITLES[role]} panel`}
    >
      <Stack spacing={1.5}>
        {topRow !== undefined || actions !== undefined ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {topRow}
            </Box>
            {actions !== undefined ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {actions}
              </Box>
            ) : null}
          </Box>
        ) : null}
        {children}
      </Stack>
    </Paper>
  );
}

export default RolePanel;
