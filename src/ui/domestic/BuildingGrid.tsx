// BuildingGrid (06.7) — CSS-grid view of the placed-buildings map plus a
// one-cell ring around it (so empty legal cells are clickable as placement
// targets when a hand card is active).
//
// Visible region: `[xMin-1 .. xMax+1] × [yMin-1 .. yMax+1]` over existing
// `grid` keys, or a 3×3 around (0,0) when the grid is empty (so the very
// first placement has somewhere to land).
//
// Two placement modes share the same grid:
//   - Building placement (domestic seat) — `activeCard` armed, empty
//     legal cells become clickable, click fires `onPlace(x, y)` →
//     `domesticBuyBuilding(name, x, y)`.
//   - Unit placement (defense seat) — `unitPlacement` set, occupied
//     non-center cells become clickable, click fires
//     `unitPlacement.onPick(cellKey)` →
//     `defenseBuyAndPlace(unitDefID, cellKey)`. The grid renders
//     read-only otherwise. Defense seats can mount the same grid in
//     their own panel for a "see the village, click a tile to station
//     a unit" flow (post-3.9 preference sweep).
//
// `isLegal` is computed via `isPlacementLegal(grid, x, y)` only when an
// `activeCard` is present — otherwise nothing on the grid is meant to be
// placed onto for buildings. Unit-placement legality is independent
// (any non-center occupied cell is legal).

import { useContext, useMemo } from 'react';
import { Box } from '@mui/material';
import {
  cellKey,
  isPlacementLegal,
} from '../../game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { BuildingDef } from '../../data/schema.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { CellSlot } from './CellSlot.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';
import { PathOverlay } from '../track/PathOverlay.tsx';
import { useActivePathHighlight } from '../track/resolveAnimation.ts';
import {
  RangeHighlightContext,
  computeRangeKeys,
} from '../track/RangeHighlightContext.ts';

export interface BuildingGridProps {
  grid: Record<string, DomesticBuilding>;
  activeCard?: BuildingDef;
  /** Building-placement click handler. Fires when an empty legal cell
   *  is clicked while `activeCard` is armed. */
  onPlace?: (x: number, y: number) => void;
  /** Defense redesign 3.2 — defense units in play; the grid groups them
   *  by `cellKey` and forwards per-cell stacks to <CellSlot>. Optional
   *  so older fixtures (e.g. the pre-2.5 hot-seat builds) render
   *  without supplying defense state. */
  units?: UnitInstance[];
  /** Pooled non-chief stash total — surfaced by the center tile. */
  pooledTotal?: number;
  /** Optional resource breakdown for the center-tile tooltip. */
  pooledBreakdown?: Array<{ resource: string; amount: number }>;
  /** Defense redesign 3.3 — cell-keys to mark as "on the threat path"
   *  (rendered with the trail tint) and "on the impact list" (rendered
   *  with the impact pulse). Both default to empty when no animation is
   *  playing. The overlay layer is anchored above the grid and reads the
   *  same cell-keys to draw the SVG arrow. */
  pathHighlight?: {
    pathKeys: ReadonlySet<string>;
    impactKeys: ReadonlySet<string>;
    firingUnitIDs?: ReadonlySet<string>;
  };
  /** Post-3.9 preference sweep — defense unit placement mode. When
   *  `selectedUnitName` is defined, occupied non-center cells become
   *  clickable; click fires `onPick(cellKey)`. The defense panel uses
   *  this so the seat sees the actual village map when stationing a
   *  unit, instead of a separate cell list. */
  unitPlacement?: {
    selectedUnitName?: string;
    onPick: (cellKey: string) => void;
  };
}

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Minimum visible radius around the vault. The village always renders
 *  this large so the table sees a full board of empty fields from
 *  round 1, just like a physical board with marked spaces. */
const MIN_VISIBLE_RADIUS = 2;

const computeBounds = (
  grid: Record<string, DomesticBuilding>,
  pad: boolean,
): Bounds => {
  let xMin = -MIN_VISIBLE_RADIUS;
  let xMax = MIN_VISIBLE_RADIUS;
  let yMin = -MIN_VISIBLE_RADIUS;
  let yMax = MIN_VISIBLE_RADIUS;
  for (const k of Object.keys(grid)) {
    const parts = k.split(',');
    if (parts.length !== 2) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  // Pad by one extra cell when the player is actively placing so the
  // first legal cell at any edge always has somewhere to land.
  if (pad) {
    xMin -= 1;
    xMax += 1;
    yMin -= 1;
    yMax += 1;
  }
  return { xMin, xMax, yMin, yMax };
};

export function BuildingGrid({
  grid,
  activeCard,
  onPlace,
  units,
  pooledTotal,
  pooledBreakdown,
  pathHighlight,
  unitPlacement,
}: BuildingGridProps) {
  const isPlacing = activeCard !== undefined;
  const isPlacingUnit = unitPlacement?.selectedUnitName !== undefined;
  // Pad the bounds when *either* placement mode is active so the grid
  // doesn't shift when the player switches between modes mid-flow.
  const { xMin, xMax, yMin, yMax } = computeBounds(grid, isPlacing || isPlacingUnit);
  const cols = xMax - xMin + 1;

  // Defense redesign 3.3 — when no explicit highlight prop is supplied,
  // fall back to the currently-animating trace from the resolve-animation
  // context. The hook is safe to call unconditionally because the default
  // context value returns `current: null` when no provider is mounted
  // (e.g. headless tests), which collapses to `undefined` here.
  const contextHighlight = useActivePathHighlight();
  const activeHighlight = pathHighlight ?? contextHighlight;

  // Range-preview keys derived from whichever unit the table is hovering
  // / focusing. `RangeHighlightContext` defaults to `null` when no
  // provider is mounted (headless tests), in which case the resulting
  // key set is empty.
  const { hoveredUnitID } = useContext(RangeHighlightContext);
  const rangeKeys = useMemo(
    () => computeRangeKeys(hoveredUnitID, units),
    [hoveredUnitID, units],
  );

  // Group defense units by `cellKey` once per render; CellSlot reads
  // the per-cell list out of this map. The values are placement-order-
  // sorted in UnitStack itself, so we leave them in the engine's
  // append order here.
  const unitsByCell = useMemo<Map<string, UnitInstance[]>>(() => {
    const map = new Map<string, UnitInstance[]>();
    if (!units) return map;
    for (const u of units) {
      const list = map.get(u.cellKey);
      if (list === undefined) {
        map.set(u.cellKey, [u]);
      } else {
        list.push(u);
      }
    }
    return map;
  }, [units]);

  // Render rows top-to-bottom, columns left-to-right. y descends visually
  // (so y=yMax is the top row) — matches a typical "looking down at the
  // village" frame.
  const rowYs: number[] = [];
  for (let y = yMax; y >= yMin; y -= 1) rowYs.push(y);
  const colXs: number[] = [];
  for (let x = xMin; x <= xMax; x += 1) colXs.push(x);

  // Defense redesign 3.3 — overlay bounds align with the rendered grid
  // (xMin..xMax × yMin..yMax). Forwarded to <PathOverlay> so the SVG
  // viewBox snaps to the same cell coordinates the grid is drawing.
  const overlayBounds = useMemo(
    () => ({ xMin, xMax, yMin, yMax }),
    [xMin, xMax, yMin, yMax],
  );

  return (
    <EmbossedFrame
      role="domestic"
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        <Box
          sx={{
            position: 'relative',
            // The relative wrapper exists so <PathOverlay>'s
            // absolutely-positioned SVG can stretch over the grid
            // without escaping the EmbossedFrame's scroll container.
          }}
        >
          <Box
            aria-label="Village building grid"
            sx={{
              display: 'grid',
              // Each cell — buildings, vault, and empty fields — renders
              // at the canonical `small` card footprint (110px wide).
              // Cells use auto rows so the height matches the tallest
              // tile in the row; the inner BuildingCard / CenterTile
              // both clamp at the small height.
              gridTemplateColumns: `repeat(${cols}, 110px)`,
              gridAutoRows: '90px',
              gap: 0.75,
            }}
          >
            {rowYs.map((y) =>
              colXs.map((x) => {
                const key = cellKey(x, y);
                const building = grid[key];
                const isLegal = isPlacing
                  ? isPlacementLegal(grid, x, y)
                  : false;
                // Compute the (up to four) orthogonal-neighbour defIDs so
                // the placed BuildingCard can paint each adjacency rule
                // as currently-firing or latent.
                let activeNeighbors: ReadonlySet<string> | undefined;
                if (building !== undefined) {
                  const ns = new Set<string>();
                  for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                  ] as const) {
                    const n = grid[cellKey(x + dx, y + dy)];
                    if (n !== undefined) ns.add(n.defID);
                  }
                  activeNeighbors = ns;
                }
                const cellUnits = unitsByCell.get(key);
                const isCenter = building?.isCenter === true;
                const onPath =
                  activeHighlight?.pathKeys.has(key) ?? false;
                const onImpact =
                  activeHighlight?.impactKeys.has(key) ?? false;
                // Unit-placement targeting: any occupied non-center
                // cell is a legal station for a unit. Empty cells stay
                // building-placement targets only.
                const isUnitTarget =
                  isPlacingUnit && building !== undefined && !isCenter;
                const inRange = rangeKeys.has(key);
                return (
                  <CellSlot
                    key={key}
                    x={x}
                    y={y}
                    building={building}
                    isLegal={isLegal}
                    isPlacing={isPlacing}
                    activeNeighbors={activeNeighbors}
                    units={cellUnits}
                    pooledTotal={isCenter ? pooledTotal : undefined}
                    pooledBreakdown={isCenter ? pooledBreakdown : undefined}
                    onPath={onPath}
                    onImpact={onImpact}
                    isUnitTarget={isUnitTarget}
                    inRange={inRange}
                    onClick={() => {
                      // Building placement: empty + legal + activeCard
                      // armed → fire onPlace.
                      if (building === undefined) {
                        if (!isPlacing || !isLegal) return;
                        onPlace?.(x, y);
                        return;
                      }
                      // Unit placement: occupied non-center + unit
                      // armed → fire unitPlacement.onPick.
                      if (isUnitTarget && unitPlacement) {
                        unitPlacement.onPick(key);
                      }
                    }}
                  />
                );
              }),
            )}
          </Box>
          {/* Overlay layer — sits above the grid, reads the active
              ResolveTrace from context, and paints the path arrow when
              a flip is animating. Click-blocking is disabled at the
              wrapper level so the overlay can't steal placements. */}
          <PathOverlay bounds={overlayBounds} />
        </Box>
      </Box>
    </EmbossedFrame>
  );
}

export default BuildingGrid;
