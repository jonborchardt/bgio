// Shared shell for role-panel layout schematics — mirrors the live
// RolePanel chrome (role-coloured border + right-aligned action row)
// without pulling in the real component, so each layout in this folder
// stays self-contained and decoupled from the running game.

import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Role } from '../../game/types.ts';

const ROLE_TITLES: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  defense: 'Defense',
};

export interface RoleFrameProps {
  role: Role;
  actions?: ReactNode;
  children: ReactNode;
}

export function RoleFrame({ role, actions, children }: RoleFrameProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: '2px solid',
        borderColor: (t) => t.palette.role[role].main,
        bgcolor: (t) => t.palette.card.surface,
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', mb: 1, minWidth: 0 }}
      >
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: (t) => t.palette.role[role].dark,
            flex: 1,
          }}
        >
          {ROLE_TITLES[role].toUpperCase()}
        </Typography>
        {actions !== undefined ? (
          <Stack direction="row" spacing={0.5}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}

export default RoleFrame;
