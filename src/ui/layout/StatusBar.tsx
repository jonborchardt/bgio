// StatusBar (09.1) — phase / current player / round at the bottom of the
// board. Renders nulls as "—" so the bar stays a fixed-width strip when the
// engine reports no phase (e.g. ctx.gameover).

import { Paper, Stack, Typography } from '@mui/material';

export interface StatusBarProps {
  phase: string | null;
  currentPlayer: string;
  round: number;
}

export function StatusBar({ phase, currentPlayer, round }: StatusBarProps) {
  return (
    <Paper
      elevation={0}
      aria-label="Status bar"
      sx={{
        px: 2,
        py: 1,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        borderRadius: 1,
      }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Phase
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{phase ?? '—'}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Current
          </Typography>
          <Typography
            sx={{ color: (t) => t.palette.status.active, fontWeight: 700 }}
          >
            Player {Number(currentPlayer) + 1}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Round
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>{round}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default StatusBar;
