// CardFrame (09.2) — visual chrome shared by every typed card.
//
// The frame draws a MUI `Paper` with two purely-visual accents:
//   - `tier`: border color from `palette.tier[tier].main`. Beginner / inter-
//     mediate / advanced map to walks of the slate ramp (see 09.4).
//   - `color`: a thin top stripe colored from `palette.eventColor[color]`. The
//     four event colors (red / gold / green / blue) double as the science-card
//     color set per 05.1, so the same accent applies to both card families.
//
// Children are rendered inside a flex column; consumers control their own
// padding / typography. No raw hex literals — every color resolves through
// the theme.

import { Box, Paper, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

export interface CardFrameProps {
  tier?: 'beginner' | 'intermediate' | 'advanced';
  color?: 'red' | 'gold' | 'green' | 'blue';
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function CardFrame({ tier, color, children, sx }: CardFrameProps) {
  return (
    <Paper
      elevation={0}
      sx={[
        {
          position: 'relative',
          px: 1.5,
          py: 1,
          minWidth: '11rem',
          borderRadius: 1,
          border: '1px solid',
          borderColor: (t) =>
            tier ? t.palette.tier[tier].main : t.palette.card.surface,
          bgcolor: (t) => t.palette.card.surface,
          color: (t) => t.palette.card.text,
          overflow: 'hidden',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {color !== undefined ? (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '0.25rem',
            bgcolor: (t) => t.palette.eventColor[color].main,
          }}
        />
      ) : null}
      <Stack spacing={0.5} sx={{ pt: color !== undefined ? 0.5 : 0 }}>
        {children}
      </Stack>
    </Paper>
  );
}

export default CardFrame;
