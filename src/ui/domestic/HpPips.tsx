// Defense redesign 3.2 — HpPips.
//
// Renders 1–4 pips for a building's current / max HP. Filled pips
// represent current HP; empty pips fill out the row up to `max`.
//
// Color states (per spec §10.2 / 3.2 plan):
//   - full          (current === max)         → palette.status.healthy
//   - damaged ≤50%  (0 < current/max ≤ 0.5)   → palette.status.warning
//   - critical hp=1 (current === 1)            → palette.status.critical
//   - everything in between (50–100%, hp > 1) → palette.status.warning
//   - empty pips                                → palette.status.muted ring
//
// `max` is constrained to [1, 4] per `BuildingDef.maxHp` validation, so
// the row fits inline next to the building's name without wrapping.
//
// The component is intentionally presentational — damage / repair
// flashes are owned by `BuildingTile` (which sees the hp delta between
// renders and tints the surrounding tile, not the pips themselves).

import { Box, Stack } from '@mui/material';
import type { Theme } from '@mui/material/styles';

export interface HpPipsProps {
  current: number;
  max: number;
  /** Pip diameter in CSS pixels. Default 8 — fits inline at the
   *  building name's row height. */
  size?: number;
}

// Pick the fill color for a pip given the building's hp ratio. Pulled
// out so the test can pin each branch via a single `current` value.
const fillTokenForState = (current: number, max: number) => (t: Theme): string => {
  if (current >= max) return t.palette.status.healthy;
  if (current <= 1) return t.palette.status.critical;
  // Strictly between 1 and max → warning.
  return t.palette.status.warning;
};

export function HpPips({ current, max, size = 8 }: HpPipsProps) {
  // Clamp inputs defensively — the theme tokens still resolve to a
  // sensible state if the caller hands us out-of-range values (we'd
  // rather render an obviously-wrong tile than throw and white-screen
  // the whole grid).
  const clampedMax = Math.max(1, Math.min(4, Math.floor(max)));
  const clampedCurrent = Math.max(0, Math.min(clampedMax, Math.floor(current)));

  const fillToken = fillTokenForState(clampedCurrent, clampedMax);
  const pips: Array<{ key: number; filled: boolean }> = [];
  for (let i = 0; i < clampedMax; i += 1) {
    pips.push({ key: i, filled: i < clampedCurrent });
  }

  return (
    <Stack
      direction="row"
      spacing={0.4}
      role="img"
      aria-label={`HP ${clampedCurrent} of ${clampedMax}`}
      data-hp-current={clampedCurrent}
      data-hp-max={clampedMax}
      data-hp-state={
        clampedCurrent >= clampedMax
          ? 'healthy'
          : clampedCurrent <= 1
            ? 'critical'
            : 'warning'
      }
      sx={{ alignItems: 'center', flexShrink: 0 }}
    >
      {pips.map((pip) => (
        <Box
          key={pip.key}
          data-hp-pip={pip.filled ? 'filled' : 'empty'}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            // Filled pips read state via the bg color. Empty pips show
            // a faint ring so the maxHp track is still legible at a
            // glance.
            bgcolor: pip.filled
              ? fillToken
              : 'transparent',
            border: '1px solid',
            borderColor: (t) =>
              pip.filled ? fillToken(t) : t.palette.status.muted,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </Stack>
  );
}

export default HpPips;
