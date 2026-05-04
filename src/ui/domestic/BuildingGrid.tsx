// BuildingGrid (06.7) — CSS-grid view of the placed-buildings map plus a
// one-cell ring around it (so empty legal cells are clickable as placement
// targets when a hand card is active).
//
// Visible region: `[xMin-1 .. xMax+1] × [yMin-1 .. yMax+1]` over existing
// `grid` keys, or a 3×3 around (0,0) when the grid is empty (so the very
// first placement has somewhere to land).
//
// `isLegal` is computed via `isPlacementLegal(grid, x, y)` only when an
// `activeCard` is present — otherwise nothing on the grid is meant to be
// placed onto.

import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  cellKey,
  isPlacementLegal,
} from '../../game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { BuildingDef } from '../../data/schema.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { CellSlot } from './CellSlot.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';

export interface BuildingGridProps {
  grid: Record<string, DomesticBuilding>;
  activeCard?: BuildingDef;
  onPlace: (x: number, y: number) => void;
  /** Defense redesign 3.2 — defense units in play; the grid groups them
   *  by `cellKey` and forwards per-cell stacks to <CellSlot>. Optional
   *  so older fixtures (e.g. the pre-2.5 hot-seat builds) render
   *  without supplying defense state. */
  units?: UnitInstance[];
  /** Pooled non-chief stash total — surfaced by the center tile. */
  pooledTotal?: number;
  /** Optional resource breakdown for the center-tile tooltip. */
  pooledBreakdown?: Array<{ resource: string; amount: number }>;
}

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const computeBounds = (
  grid: Record<string, DomesticBuilding>,
  pad: boolean,
): Bounds => {
  const keys = Object.keys(grid);
  if (keys.length === 0) {
    // Empty grid: only meaningful while placing (3x3 around origin lets the
    // first placement land somewhere). When not placing we'd render nothing,
    // so the panel-level empty state takes over instead.
    return pad
      ? { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
      : { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  }
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const k of keys) {
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
  // Pad by one cell only while the player is actively placing — otherwise
  // the grid would visually shift after each placement (a freshly-placed
  // edge cell would suddenly appear interior because the bounds grew on
  // every side). With pad gated on isPlacing, the placed building stays
  // exactly where the player clicked it.
  if (!pad) return { xMin, xMax, yMin, yMax };
  return {
    xMin: xMin - 1,
    xMax: xMax + 1,
    yMin: yMin - 1,
    yMax: yMax + 1,
  };
};

export function BuildingGrid({
  grid,
  activeCard,
  onPlace,
  units,
  pooledTotal,
  pooledBreakdown,
}: BuildingGridProps) {
  const isPlacing = activeCard !== undefined;
  const { xMin, xMax, yMin, yMax } = computeBounds(grid, isPlacing);
  const cols = xMax - xMin + 1;
  const isEmpty = Object.keys(grid).length === 0;

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
      {isEmpty && !isPlacing ? (
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            py: 2,
          }}
        >
          Empty village — select a building to place.
        </Typography>
      ) : (
        <Box
          aria-label="Domestic building grid"
          sx={{
            display: 'grid',
            // Column width matches the `normal` card (180px) plus a
            // small gutter; cells are fixed-aspect to match the
            // physical-card height. Village cards render at the
            // medium / `normal` size so the village board reads as a
            // tile grid rather than a detailed deck.
            gridTemplateColumns: `repeat(${cols}, 190px)`,
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
                  onClick={() => {
                    if (building !== undefined) return;
                    if (!isPlacing || !isLegal) return;
                    onPlace(x, y);
                  }}
                />
              );
            }),
          )}
        </Box>
      )}
    </EmbossedFrame>
  );
}

export default BuildingGrid;
