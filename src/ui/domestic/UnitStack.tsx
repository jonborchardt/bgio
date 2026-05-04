// Defense redesign 3.2 — UnitStack.
//
// Vertical stack visualizer for the units placed on a single building
// tile. Per spec D13 / §10.4, the **first-placed** unit must be the
// **visually bottom** one so "first in, first killed" reads at a
// glance.
//
// Sort order: ascending `placementOrder`. The component renders the
// list with `flexDirection: 'column-reverse'` so the lowest
// placementOrder lands at the bottom of the stack while the source
// array stays in placement order — this keeps the bottom-up consumption
// rule visible in the DOM order too.
//
// Stack overflow: if more than `VISIBLE_LIMIT` (default 3) units sit
// on the same tile, only the top `VISIBLE_LIMIT - 1` newest units are
// rendered explicitly; the bottom slot becomes a "+N more" badge that
// reveals the full list on hover/click via a tooltip listing each
// unit by name in placement order.
//
// Drilled units carry a small "✦" indicator overlay (refined further
// in 3.6); taught skills are rendered as a tiny tag row beneath the
// unit's name.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { UNITS } from '../../data/index.ts';

export interface UnitStackProps {
  /** Units placed on this tile. Order does not matter — the component
   *  re-sorts by `placementOrder` ascending. */
  units: UnitInstance[];
  /** How many slots to render before collapsing to a "+N more" badge.
   *  Defaults to 3 per the 3.2 plan. */
  visibleLimit?: number;
}

const DEFAULT_VISIBLE_LIMIT = 3;

interface UnitChipProps {
  unit: UnitInstance;
}

// Single-unit chip. Reads display state off the instance + the
// underlying UnitDef (for max-hp comparison). Drill / teach indicators
// are surfaced inline; refinement of those visuals is owned by 3.6.
function UnitChip({ unit }: UnitChipProps) {
  const def = UNITS.find((u) => u.name === unit.defID);
  const drilled = unit.drillToken === true;
  const taughtSkills = unit.taughtSkills ?? [];
  const tooltip = (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {unit.defID}
      </Typography>
      <Typography variant="caption">
        HP {unit.hp}
        {def ? ` / ${def.hp}` : ''} · order #{unit.placementOrder}
      </Typography>
      {drilled ? (
        <Typography variant="caption">Drilled — next fire +1 strength</Typography>
      ) : null}
      {taughtSkills.length > 0 ? (
        <Typography variant="caption">
          Taught: {taughtSkills.join(', ')}
        </Typography>
      ) : null}
    </Stack>
  );
  return (
    <Tooltip title={tooltip} placement="right">
      <Box
        data-unit-id={unit.id}
        data-unit-def={unit.defID}
        data-unit-order={unit.placementOrder}
        aria-label={`Unit ${unit.defID} (order ${unit.placementOrder}, hp ${unit.hp})`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 0.6,
          py: 0.25,
          borderRadius: 0.75,
          bgcolor: (t) => t.palette.role.defense.dark,
          color: (t) => t.palette.role.defense.contrastText,
          fontSize: '0.7rem',
          fontWeight: 600,
          gap: 0.4,
          minHeight: 18,
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {unit.defID}
        </Box>
        <Stack direction="row" spacing={0.3} sx={{ alignItems: 'center' }}>
          {drilled ? (
            <Box
              component="span"
              data-drill="true"
              aria-label="Drilled"
              sx={{
                color: (t) => t.palette.status.warning,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ✦
            </Box>
          ) : null}
          {taughtSkills.length > 0 ? (
            <Box
              component="span"
              data-taught-count={taughtSkills.length}
              aria-label={`${taughtSkills.length} taught skill${taughtSkills.length === 1 ? '' : 's'}`}
              sx={{
                fontSize: '0.6rem',
                color: (t) => t.palette.role.science.light,
                fontWeight: 700,
              }}
            >
              +{taughtSkills.length}
            </Box>
          ) : null}
          <Box component="span" sx={{ opacity: 0.85 }}>
            {unit.hp}
          </Box>
        </Stack>
      </Box>
    </Tooltip>
  );
}

export function UnitStack({
  units,
  visibleLimit = DEFAULT_VISIBLE_LIMIT,
}: UnitStackProps) {
  if (units.length === 0) return null;

  // Defensive copy + ascending sort. `placementOrder` is monotonic but
  // the prop's source order is not guaranteed (callers group by
  // cellKey, which preserves the engine's array order — typically
  // already monotonic, but we don't assume).
  const sorted = [...units].sort((a, b) => a.placementOrder - b.placementOrder);

  // Stack-overflow handling: when sorted.length > visibleLimit, render
  // the (visibleLimit - 1) newest units explicitly and reserve the
  // bottom-most visible slot for a "+N more" badge that reveals the
  // hidden (oldest) units on hover.
  let visible: UnitInstance[];
  let hidden: UnitInstance[] = [];
  if (sorted.length > visibleLimit) {
    const headroom = Math.max(1, visibleLimit - 1);
    // sorted is oldest-first; the newest are at the tail.
    visible = sorted.slice(sorted.length - headroom);
    hidden = sorted.slice(0, sorted.length - headroom);
  } else {
    visible = sorted;
  }

  // Render with column-reverse so the first element of `visible` (the
  // oldest visible unit) lands visually at the bottom. The "+N more"
  // badge, when present, sits below even that.
  const overflowTooltip = (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        Earlier on this tile (oldest first)
      </Typography>
      {hidden.map((u) => (
        <Typography key={u.id} variant="caption">
          #{u.placementOrder} {u.defID} (hp {u.hp})
        </Typography>
      ))}
    </Stack>
  );

  return (
    <Stack
      data-unit-stack="true"
      data-unit-count={sorted.length}
      aria-label={`Units on tile (${sorted.length})`}
      spacing={0.25}
      sx={{
        // column-reverse so the lowest placementOrder visible is at the
        // visual bottom of the stack — D13's "first in, first killed"
        // expectation.
        flexDirection: 'column-reverse',
        // Don't let the stack run wider than the tile content area.
        minWidth: 0,
        width: '100%',
      }}
    >
      {visible.map((u) => (
        <UnitChip key={u.id} unit={u} />
      ))}
      {hidden.length > 0 ? (
        <Tooltip title={overflowTooltip} placement="right">
          <Box
            data-unit-stack-overflow={hidden.length}
            aria-label={`+${hidden.length} more units`}
            sx={{
              px: 0.6,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: (t) => t.palette.role.defense.main,
              color: (t) => t.palette.role.defense.contrastText,
              fontSize: '0.65rem',
              fontWeight: 700,
              textAlign: 'center',
              opacity: 0.8,
            }}
          >
            +{hidden.length} more
          </Box>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

export default UnitStack;
