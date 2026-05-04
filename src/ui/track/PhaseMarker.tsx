// Defense redesign 3.1 — phase marker.
//
// Small chip rendered above each phase span on the track strip. The
// marker carries the phase number (or "Boss" for phase 10's boss
// slot) and pulls its accent from `palette.track.phaseMarkers[phase
// - 1]` so the gradient stays the single source of truth across
// phases. The `active` prop highlights the phase that contains the
// current / next card so the table can read "we're in phase 4 right
// now" at a glance.

import { Box, Typography } from '@mui/material';

export interface PhaseMarkerProps {
  phase: number;
  /** When true, render with a thicker / brighter outline. */
  active?: boolean;
  /** When true, render as the boss marker (phase 10). */
  boss?: boolean;
}

export function PhaseMarker({ phase, active = false, boss = false }: PhaseMarkerProps) {
  const label = boss ? 'Boss' : `P${phase}`;
  return (
    <Box
      role="status"
      aria-label={boss ? 'Boss phase marker' : `Phase ${phase} marker`}
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
          boss
            ? t.palette.track.boss
            : t.palette.track.phaseMarkers[Math.max(0, Math.min(9, phase - 1))]!,
        bgcolor: (t) =>
          active
            ? boss
              ? t.palette.track.boss
              : t.palette.track.phaseMarkers[Math.max(0, Math.min(9, phase - 1))]!
            : 'transparent',
        color: (t) =>
          active
            ? t.palette.card.text
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
  );
}

export default PhaseMarker;
