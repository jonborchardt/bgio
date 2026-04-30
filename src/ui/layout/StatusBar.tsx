// StatusBar (09.1) — phase / current player / round at the bottom of the
// board. Renders nulls as "—" so the bar stays a fixed-width strip when the
// engine reports no phase (e.g. ctx.gameover).

import { Paper, Stack, Typography } from '@mui/material';

export type StatusBarMode = 'hotseat' | 'networked' | 'spectating';

export interface StatusBarProps {
  phase: string | null;
  currentPlayer: string;
  round: number;
  /** 14.3 — actual client mode (hotseat / networked / spectating).
   *  Replaces the older `spectating` boolean which only captured one
   *  of the three states. Optional so older test fixtures stay
   *  source-compatible (they fall through to no badge). */
  mode?: StatusBarMode;
}

const MODE_LABEL: Record<StatusBarMode, string> = {
  hotseat: 'Hot-seat',
  networked: 'Networked',
  spectating: 'Spectating',
};

export function StatusBar({
  phase,
  currentPlayer,
  round,
  mode,
}: StatusBarProps) {
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
        {mode ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'baseline', ml: 'auto' }}
            aria-label="Client mode"
          >
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
            >
              Mode
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{MODE_LABEL[mode]}</Typography>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default StatusBar;
