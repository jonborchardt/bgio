// Small pill used inside layout schematics to stand in for a
// concrete control (a button, a chip, a tile, a card slot) without
// pulling in the real component. Renders as a labeled rounded box
// with optional role tinting.

import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Role } from '../../game/types.ts';

export interface ChipProps {
  label: string;
  role?: Role;
  filled?: boolean;
  sx?: SxProps<Theme>;
}

export function Chip({ label, role, filled, sx }: ChipProps) {
  return (
    <Box
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          px: 1,
          py: 0.25,
          border: '1px solid',
          borderColor: (t) =>
            role !== undefined
              ? t.palette.role[role].main
              : t.palette.status.muted,
          bgcolor: (t) =>
            filled
              ? role !== undefined
                ? t.palette.role[role].main
                : t.palette.status.muted
              : role !== undefined
                ? alpha(t.palette.role[role].main, 0.08)
                : 'transparent',
          color: (t) =>
            filled
              ? role !== undefined
                ? t.palette.role[role].contrastText
                : t.palette.background.paper
              : t.palette.text.primary,
          fontSize: '0.7rem',
          lineHeight: 1.4,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default Chip;
