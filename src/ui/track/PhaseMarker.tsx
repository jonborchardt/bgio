// Defense redesign 3.1 — phase marker.
//
// Small chip rendered above each phase span on the track strip. The
// marker carries the phase number (or "Boss" for phase 10's boss
// slot) and pulls its accent from `palette.track.phaseMarkers[phase
// - 1]` so the gradient stays the single source of truth across
// phases. The `active` prop highlights the phase that contains the
// current / next card so the table can read "we're in phase 4 right
// now" at a glance.

import { Box, Tooltip, Typography } from '@mui/material';

export interface PhaseMarkerProps {
  phase: number;
  /** When true, render with a thicker / brighter outline. */
  active?: boolean;
  /** When true, render as the boss marker (phase 10). */
  boss?: boolean;
}

export function PhaseMarker({ phase, active = false, boss = false }: PhaseMarkerProps) {
  const label = boss ? 'Boss' : `P${phase}`;
  // Defense redesign 3.9 — plain-English tooltip per phase. Boss has its
  // own copy because the table reads it as different from a regular
  // phase marker; non-boss phases share a difficulty hint that scales
  // with the phase number.
  const tooltip = boss
    ? 'Phase 10 — boss flips here. Each met threshold drops one boss attack.'
    : `Phase ${phase} of 10 — difficulty climbs each phase, with the boss at phase 10.`;
  return (
    <Tooltip title={tooltip} placement="top">
      <Box
        role="status"
        aria-label={
          boss
            ? 'Boss phase marker (phase 10)'
            : `Phase ${phase} of 10 marker${active ? ', active' : ''}`
        }
        data-phase={phase}
        data-active={active ? 'true' : 'false'}
        data-boss={boss ? 'true' : 'false'}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 0.75,
          py: 0.25,
          borderRadius: 999,
          minWidth: 28,
          height: 18,
          border: '1px solid',
          borderColor: (t) =>
            active
              ? t.palette.track.current
              : boss
                ? t.palette.track.boss
                : t.palette.track.phaseMarkers[Math.max(0, Math.min(9, phase - 1))]!,
          // Active fill uses the shared `track.current` accent (same yellow
          // the just-flipped card uses) regardless of phase index, with a
          // dark text for legible contrast. Earlier passes mapped active
          // bg to `phaseMarkers[idx]` directly, which collapsed P1's near-
          // white slot against the near-white card.text — the label
          // disappeared. Routing every active marker through `track.current`
          // keeps the gradient story (the border still shifts hue per
          // phase) while guaranteeing legibility.
          bgcolor: (t) => (active ? t.palette.track.current : 'transparent'),
          color: (t) =>
            active
              ? t.palette.card.takenSurface
              : boss
                ? t.palette.track.boss
                : t.palette.track.phaseMarkers[Math.max(0, Math.min(9, phase - 1))]!,
          transition: 'background-color 150ms ease, border-color 150ms ease',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.6rem',
            letterSpacing: '0.06em',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default PhaseMarker;
