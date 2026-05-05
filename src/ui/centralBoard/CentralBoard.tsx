// CentralBoard — unified frame for the table-shared "game board".
//
// Layout (CSS grid, single row under the track strip):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ [track strip]                                            │
//   │ 1fr · village · 1fr · science · economy · 1fr            │
//   └──────────────────────────────────────────────────────────┘
//
// The 1fr gutters absorb extra page width without stretching the
// village or the trackers. Science + Economy sit together on the
// right so the table reads them as a paired boss telegraph.
//
// Thin layout shell. Each slot is a ReactNode the parent fills in;
// CentralBoard owns the surrounding Paper frame, the grid template,
// and the `position: relative` content well that step-playback HUDs
// anchor against.

import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

export interface CentralBoardProps {
  /** The track strip — already-built `<TrackStrip>` from the parent. */
  track: ReactNode;
  /** The village grid — already-built `<BuildingGrid>` from the parent. */
  village: ReactNode;
  /** Science progress tracker. Rendered to the right of the village. */
  scienceTracker?: ReactNode;
  /** Economy progress tracker. Rendered next to the science tracker. */
  economyTracker?: ReactNode;
  /** Floating overlays anchored against the village content well —
   *  typically the step-playback HUD. */
  overlay?: ReactNode;
}

export function CentralBoard({
  track,
  village,
  scienceTracker,
  economyTracker,
  overlay,
}: CentralBoardProps) {
  return (
    <Paper
      data-testid="central-board"
      role="region"
      aria-label="Game board"
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        boxShadow: (t) => t.palette.shadow.card,
      }}
    >
      <Stack spacing={1.25} sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          variant="h5"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.04em',
            textAlign: 'center',
            color: (t) => t.palette.text.primary,
            mb: 0,
          }}
        >
          Settlement
        </Typography>
        {track}

        <Box
          sx={{
            position: 'relative',
            display: 'grid',
            // 1fr | village | 1fr | science | economy | 1fr
            gridTemplateColumns:
              '1fr auto 1fr auto auto 1fr',
            alignItems: 'flex-start',
            columnGap: 1.5,
            minWidth: 0,
          }}
        >
          {/* Leading 1fr gutter (empty). */}
          <Box aria-hidden />

          <Box
            data-testid="central-board-village-well"
            sx={{
              position: 'relative',
              minWidth: 0,
            }}
          >
            {village}
            {overlay}
          </Box>

          {/* Mid 1fr gutter between the village and the trackers. */}
          <Box aria-hidden />

          <Box
            data-testid="central-board-science-slot"
            sx={{ pt: 1.5, display: 'flex', justifyContent: 'center' }}
          >
            {scienceTracker}
          </Box>
          <Box
            data-testid="central-board-economy-slot"
            sx={{ pt: 1.5, display: 'flex', justifyContent: 'center' }}
          >
            {economyTracker}
          </Box>

          {/* Trailing 1fr gutter (empty). */}
          <Box aria-hidden />
        </Box>
      </Stack>
    </Paper>
  );
}

export default CentralBoard;
