// RolePanel — shared shell for the four role panels (chief / science /
// domestic / foreign). Owns the Paper container, role-themed border, the
// title, and an optional right-aligned action row, so each panel only has
// to provide its body content.

import { Box, Paper, Stack, Typography } from '@mui/material';
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
  children: ReactNode;
}

export function RolePanel({ role, actions, children }: RolePanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role[role].main,
      }}
      aria-label={`${ROLE_TITLES[role]} panel`}
    >
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: (t) => t.palette.role[role].main,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {ROLE_TITLES[role]}
        </Typography>
        {actions !== undefined ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {actions}
          </Box>
        ) : null}
        {children}
      </Stack>
    </Paper>
  );
}

export default RolePanel;
