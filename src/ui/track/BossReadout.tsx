// Defense redesign 3.5 — boss thresholds readout.
//
// When the boss card sits in the next-card slot of the global event track,
// the village wants to know *exactly* where they stand against the three
// printed thresholds (D21 / spec §10.6). This panel surfaces a side-by-
// side comparison: the village's current Science / Economy / Military
// totals against the boss's required numbers, with a per-row met / unmet
// indicator and a live "attacks remaining" line that mirrors `resolveBoss`'
// math (`max(0, baseAttacks - thresholdsMet)`).
//
// Render contract:
//   - Pure presentation. No moves dispatched. The parent (TrackStrip)
//     decides whether the boss is in the next slot; this component does
//     not gate-keep itself on the track state.
//   - Visual tokens come from `palette.bossReadout.*` (3.5 added) and
//     `palette.track.boss` for the panel border. No raw hex literals.
//   - Met / unmet is paired with a ✓ / ✗ glyph alongside color so the
//     panel reads on a color-blind display (CLAUDE.md accessibility
//     rule + the plan's explicit "shape + color, not color alone").
//   - Numbers stay readable in both met and unmet states — surface
//     tints are subtle and the foreground text comes from the readout's
//     own `text` token, not the row accent.
//
// The recommendation line is a small heuristic ("meet 1 more threshold
// to drop to N attacks"). It's a nice-to-have per the plan; we ship it
// because the math is one line and the table benefits from the framing.

import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { BossCard } from '../../data/index.ts';

export interface BossReadoutProps {
  /** The boss card driving the readout. Reads `name`, `thresholds`,
   *  and `baseAttacks` for display + math. */
  boss: BossCard;
  /** Live village totals — computed once by the parent (Board.tsx) so
   *  the readout updates as science completes / units gain strength /
   *  bank changes. The keys mirror `BossThresholds`. */
  current: {
    science: number;
    economy: number;
    military: number;
  };
  /** Post-3.9 preference sweep — when `true`, the boss has not yet
   *  flipped (it still sits in `upcoming`). The readout renders in a
   *  subdued / desaturated treatment so the table reads it as a
   *  "looming" threat preview, not a flipped card. When `false` the
   *  boss has already flipped (now in `history`); the readout shows at
   *  full strength as the audit/result panel. */
  looming?: boolean;
}

// Per-row config drives the rendered list. Keeping this as a small
// readonly tuple lets the row order stay deterministic (Sci → Eco →
// Mil) regardless of how `current` keys are iterated.
type ThresholdKey = 'science' | 'economy' | 'military';

interface RowSpec {
  key: ThresholdKey;
  label: string;
  short: string; // ARIA-readable shorthand for screen readers.
}

const ROWS: ReadonlyArray<RowSpec> = [
  { key: 'science', label: 'Science', short: 'Sci' },
  { key: 'economy', label: 'Economy', short: 'Eco' },
  { key: 'military', label: 'Military', short: 'Mil' },
] as const;

// ✓ / ✗ glyph. Drawn as inline SVG so the icon scales with the row's
// font size and the stroke color follows `currentColor`. Stroke-only,
// no fill, so the silhouette stays crisp at small sizes.
function MetGlyph({ met, size = 14 }: { met: boolean; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}
    >
      <svg viewBox="0 0 16 16" width={size} height={size}>
        {met ? (
          <path
            d="M3 8.5 L7 12 L13 4"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <path
            d="M4 4 L12 12 M12 4 L4 12"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </Box>
  );
}

interface ThresholdRowProps {
  label: string;
  short: string;
  current: number;
  required: number;
  met: boolean;
}

function ThresholdRow({ label, short, current, required, met }: ThresholdRowProps) {
  // Defense redesign 3.9 — plain-English tooltip per row. Reads the
  // delta to the threshold so the table knows how far off (or how much
  // surplus) it has.
  const delta = current - required;
  const tooltip = met
    ? `${label} threshold met (${current} of ${required}, +${delta} surplus). Subtracts one boss attack.`
    : `${label} threshold NOT met (${current} of ${required}, need ${-delta} more). Counts as one extra boss attack.`;
  return (
    <Tooltip title={tooltip} placement="top">
      <Stack
        direction="row"
        spacing={1}
        role="listitem"
        data-testid={`boss-readout-row-${short.toLowerCase()}`}
        data-met={met ? 'true' : 'false'}
        aria-label={`${label}: ${current} of ${required} ${met ? 'met' : 'not met'}`}
        sx={{
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: (t) =>
            met ? t.palette.bossReadout.metAccent : t.palette.bossReadout.unmetAccent,
          bgcolor: (t) =>
            met ? t.palette.bossReadout.metSurface : t.palette.bossReadout.unmetSurface,
          color: (t) => t.palette.bossReadout.text,
        }}
      >
        <Box
          sx={{
            color: (t) =>
              met ? t.palette.bossReadout.metAccent : t.palette.bossReadout.unmetAccent,
            display: 'inline-flex',
          }}
        >
          <MetGlyph met={met} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            width: 64,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
          }}
        >
          {current} / {required}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

// Tiny per-row helper. Kept inline rather than exported because the
// component owns the comparison semantics ("≥ required, integer-only").
const isMet = (current: number, required: number): boolean =>
  current >= required;

export function BossReadout({ boss, current, looming = false }: BossReadoutProps) {
  const rows = ROWS.map((spec) => {
    const required = boss.thresholds[spec.key];
    const cur = current[spec.key];
    return {
      ...spec,
      current: cur,
      required,
      met: isMet(cur, required),
    };
  });

  const metCount = rows.reduce((acc, r) => (r.met ? acc + 1 : acc), 0);
  // Mirrors `resolveBoss` exactly: each met threshold subtracts one
  // attack from the boss's `baseAttacks` budget, clamped at 0.
  const attacksRemaining = Math.max(0, boss.baseAttacks - metCount);

  // Recommendation line. Heuristic only — surfaces the marginal benefit
  // of meeting one more threshold so the table can prioritise.
  const unmetCount = rows.length - metCount;
  const nextAttacks = Math.max(0, boss.baseAttacks - (metCount + 1));
  const recommendation =
    unmetCount === 0
      ? 'All thresholds met — push to flip.'
      : `Meet 1 more threshold to drop to ${nextAttacks} attack${
          nextAttacks === 1 ? '' : 's'
        }.`;

  return (
    <Paper
      elevation={0}
      role="region"
      aria-label={`Boss readout — ${boss.name}${looming ? ' (looming)' : ''}`}
      data-testid="boss-readout"
      data-boss-readout-looming={looming ? 'true' : 'false'}
      sx={{
        flexShrink: 0,
        width: 220,
        px: 1.25,
        py: 1,
        borderRadius: 1,
        // Looming preview reads as "not yet here": dashed border at
        // half saturation, slate-muted background, panel-wide opacity
        // pull so it visibly recedes against the rest of the strip.
        // Once the boss flips into history we drop back to the solid
        // 2px boss-accent border so the readout reads as a confirmed
        // resolution panel.
        border: looming ? '2px dashed' : '2px solid',
        borderColor: (t) => t.palette.track.boss,
        bgcolor: (t) =>
          looming ? t.palette.card.takenSurface : t.palette.card.surface,
        color: (t) => t.palette.bossReadout.text,
        opacity: looming ? 0.65 : 1,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: (t) => t.palette.track.boss,
            }}
          >
            Boss
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              lineHeight: 1.15,
              fontSize: '0.78rem',
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {boss.name}
          </Typography>
        </Stack>

        <Stack
          spacing={0.5}
          role="list"
          aria-label="Boss thresholds"
        >
          {rows.map((r) => (
            <ThresholdRow
              key={r.key}
              label={r.label}
              short={r.short}
              current={r.current}
              required={r.required}
              met={r.met}
            />
          ))}
        </Stack>

        <Box
          sx={{
            height: '1px',
            bgcolor: (t) => t.palette.status.muted,
            opacity: 0.3,
          }}
          aria-hidden
        />

        <Stack spacing={0.25}>
          <Typography
            variant="caption"
            data-testid="boss-readout-attacks"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: (t) => t.palette.bossReadout.text,
            }}
          >
            Attacks remaining: {boss.baseAttacks} − {metCount} = {attacksRemaining}
          </Typography>
          <Typography
            variant="caption"
            data-testid="boss-readout-recommendation"
            sx={{
              fontSize: '0.65rem',
              fontStyle: 'italic',
              color: (t) => t.palette.status.muted,
              lineHeight: 1.2,
            }}
          >
            {recommendation}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default BossReadout;
