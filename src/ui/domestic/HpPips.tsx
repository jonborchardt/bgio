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
//
// Defense-redesign 3.9 polish:
//   - HP state is communicated by **shape + color**: critical pips render
//     with an inner "X" mark, warning pips with an inner "!" stroke, and
//     healthy pips stay as plain filled circles. Color-blind users can
//     read the state without depending on the green / amber / red ramp.
//   - The whole row is wrapped in a `Tooltip` whose plain-English label
//     explains what the pips mean ("3/4 hp — damaged but stable").

import { Box, Stack, Tooltip } from '@mui/material';
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

// Plain-English description of the HP state. Surfaced in the tooltip
// so non-developers can read the row without inferring from color.
const stateLabel = (current: number, max: number): string => {
  if (current >= max) return 'fully healed';
  if (current <= 1) return 'critical — one more hit destroys this slot of capacity';
  if (current * 2 <= max) return 'damaged — yields are halved or worse';
  return 'damaged but stable';
};

// Defense redesign 3.9 — color-blind-safe shape variants. The pip always
// reads as a circle but the *state* is reinforced by an inner shape:
//   - healthy  → solid circle (no overlay)
//   - warning  → "!" stroke for "watch this"
//   - critical → "x" stroke for "about to break"
// Empty pips render as a hollow ring with no inner shape; the row's
// total length still communicates max hp at a glance.
type PipShape = 'healthy' | 'warning' | 'critical' | 'empty';

const shapeFor = (filled: boolean, current: number, max: number): PipShape => {
  if (!filled) return 'empty';
  if (current >= max) return 'healthy';
  if (current <= 1) return 'critical';
  return 'warning';
};

interface PipShapeOverlayProps {
  shape: PipShape;
  size: number;
}

function PipShapeOverlay({ shape, size }: PipShapeOverlayProps) {
  if (shape === 'healthy' || shape === 'empty') return null;
  // Ratio of inner mark to pip diameter — keeps the silhouette readable
  // even at the default 8px pip size.
  const inset = size * 0.25;
  const innerSize = size - inset * 2;
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'absolute',
        top: inset,
        left: inset,
        width: innerSize,
        height: innerSize,
        pointerEvents: 'none',
        // Inner mark contrasts with the filled pip color.
        color: (t) => t.palette.card.text,
      }}
    >
      <svg viewBox="0 0 8 8" width={innerSize} height={innerSize}>
        {shape === 'critical' ? (
          <path
            d="M2 2 L6 6 M6 2 L2 6"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          // warning — exclamation stroke
          <>
            <path
              d="M4 1.5 L4 4.5"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              fill="none"
            />
            <circle cx={4} cy={6.2} r={0.7} fill="currentColor" />
          </>
        )}
      </svg>
    </Box>
  );
}

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

  const stateName =
    clampedCurrent >= clampedMax
      ? 'healthy'
      : clampedCurrent <= 1
        ? 'critical'
        : 'warning';
  const tooltip = `HP ${clampedCurrent} / ${clampedMax} — ${stateLabel(
    clampedCurrent,
    clampedMax,
  )}`;

  return (
    <Tooltip title={tooltip} placement="top">
      <Stack
        direction="row"
        spacing={0.4}
        role="img"
        aria-label={`HP ${clampedCurrent} of ${clampedMax}, ${stateName}`}
        data-hp-current={clampedCurrent}
        data-hp-max={clampedMax}
        data-hp-state={stateName}
        sx={{ alignItems: 'center', flexShrink: 0 }}
      >
        {pips.map((pip) => {
          const shape = shapeFor(pip.filled, clampedCurrent, clampedMax);
          return (
            <Box
              key={pip.key}
              data-hp-pip={pip.filled ? 'filled' : 'empty'}
              data-hp-pip-shape={shape}
              sx={{
                position: 'relative',
                width: size,
                height: size,
                borderRadius: '50%',
                // Filled pips read state via the bg color. Empty pips show
                // a faint ring so the maxHp track is still legible at a
                // glance.
                bgcolor: pip.filled ? fillToken : 'transparent',
                border: '1px solid',
                borderColor: (t) =>
                  pip.filled ? fillToken(t) : t.palette.status.muted,
                boxSizing: 'border-box',
              }}
            >
              <PipShapeOverlay shape={shape} size={size} />
            </Box>
          );
        })}
      </Stack>
    </Tooltip>
  );
}

export default HpPips;
