// CentralBoard — unified frame for the table-shared "game board": the
// global event track strip on top, the village (domestic grid) below.
//
// This component is intentionally a thin layout shell. The track strip
// and village grid are still authored in their own modules; the parent
// (Board.tsx) builds them and passes them in as nodes. CentralBoard
// owns:
//
//   - the outer Paper frame so the two pieces read as one map,
//   - a thin header strip with board-status slots (round, phase,
//     science level) that future UI passes can extend,
//   - a `position: relative` content well so step-playback HUDs
//     (ResolveStepBanner) and other floating overlays can anchor against
//     the central board itself rather than the page.
//
// All visual choices route through theme tokens (CLAUDE.md rule).

import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

export interface CentralBoardStat {
  /** Short label rendered above the value (e.g. "Round"). */
  label: string;
  /** Stringified value. Numbers should already be formatted by the caller. */
  value: string;
  /** Optional accessible description; falls back to "label value". */
  ariaLabel?: string;
}

export interface CentralBoardProps {
  /** The track strip — already-built `<TrackStrip>` from the parent. */
  track: ReactNode;
  /** The village grid — already-built `<BuildingGrid>` from the parent. */
  village: ReactNode;
  /** Header status slots (round, phase, science level, …). Rendered
   *  left-to-right in a small row above the track strip. The list is
   *  ordered by the caller; CentralBoard makes no assumption about which
   *  stats are present. Empty array → header collapses to just the title. */
  stats?: ReadonlyArray<CentralBoardStat>;
  /** Floating overlays anchored against the content well — typically the
   *  step-playback HUD. Rendered above `village` with absolute positioning
   *  by the consumer; CentralBoard just provides the relative wrapper. */
  overlay?: ReactNode;
}

/**
 * Single status pill in the central board header. Pure presentation; the
 * label / value strings are formatted by the caller so the component
 * stays domain-agnostic (future status slots — e.g. "Track phase",
 * "Science level", "Buildings repaired this round" — drop in without
 * editing this module).
 */
function StatPill({ label, value, ariaLabel }: CentralBoardStat) {
  return (
    <Box
      role="status"
      aria-label={ariaLabel ?? `${label} ${value}`}
      data-testid={`central-board-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: 0.75,
        bgcolor: (t) => t.palette.appSurface.base,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        minWidth: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1.1,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.6rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: (t) => t.palette.status.muted,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: (t) => t.palette.text.primary,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function CentralBoard({
  track,
  village,
  stats,
  overlay,
}: CentralBoardProps) {
  return (
    <Paper
      data-testid="central-board"
      role="region"
      aria-label="Central board"
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
        {/* Header row — board title plus status pills. */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: 'center',
            flexWrap: 'wrap',
            rowGap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: (t) => t.palette.status.muted,
            }}
          >
            Central Board
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {stats !== undefined && stats.length > 0 ? (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
              {stats.map((s) => (
                <StatPill key={s.label} {...s} />
              ))}
            </Stack>
          ) : null}
        </Stack>

        {/* Track strip. */}
        {track}

        {/* Village content well. `position: relative` so any consumer
            overlays (step-playback HUD, future tooltips) anchor to this
            block. The actual village grid scrolls horizontally on its
            own — we don't wrap it again here. */}
        <Box sx={{ position: 'relative' }}>
          {village}
          {overlay}
        </Box>
      </Stack>
    </Paper>
  );
}

export default CentralBoard;
