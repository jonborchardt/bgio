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

import { Box, Stack, Typography } from '@mui/material';
import {
  cellKey,
  isPlacementLegal,
} from '../../game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { BuildingDef } from '../../data/schema.ts';
import { CellSlot } from './CellSlot.tsx';

export interface BuildingGridProps {
  grid: Record<string, DomesticBuilding>;
  activeCard?: BuildingDef;
  onPlace: (x: number, y: number) => void;
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
}: BuildingGridProps) {
  const isPlacing = activeCard !== undefined;
  const { xMin, xMax, yMin, yMax } = computeBounds(grid, isPlacing);
  const cols = xMax - xMin + 1;
  const isEmpty = Object.keys(grid).length === 0;

  // Render rows top-to-bottom, columns left-to-right. y descends visually
  // (so y=yMax is the top row) — matches a typical "looking down at the
  // village" frame.
  const rowYs: number[] = [];
  for (let y = yMax; y >= yMin; y -= 1) rowYs.push(y);
  const colXs: number[] = [];
  for (let x = xMin; x <= xMax; x += 1) colXs.push(x);

  return (
    <Stack
      spacing={0.75}
      sx={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        alignItems: 'center',
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role.domestic.main,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
        }}
      >
        Village
      </Typography>
      {isEmpty && !isPlacing ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
        >
          Empty village — select a building to place.
        </Typography>
      ) : (
        <Box
          sx={{
            width: '100%',
            minWidth: 0,
            overflowX: 'auto',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            aria-label="Domestic building grid"
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 7rem)`,
              gap: 0.5,
            }}
          >
            {rowYs.map((y) =>
              colXs.map((x) => {
                const key = cellKey(x, y);
                const building = grid[key];
                const isLegal = isPlacing
                  ? isPlacementLegal(grid, x, y)
                  : false;
                return (
                  <CellSlot
                    key={key}
                    x={x}
                    y={y}
                    building={building}
                    isLegal={isLegal}
                    isPlacing={isPlacing}
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
        </Box>
      )}
    </Stack>
  );
}

export default BuildingGrid;
