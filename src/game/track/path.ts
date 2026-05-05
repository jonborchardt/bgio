// Defense redesign 2.3 — pure geometry helpers for the threat-resolution
// pipeline.
//
// Threats walk in a straight line toward the center tile at `(0, 0)`. A
// threat card prints a `direction` (N / E / S / W) and an `offset` (a
// signed integer along the perpendicular axis). The path is the ordered
// list of cells the threat would traverse, from its entry point at the
// edge of the populated grid all the way to (and including) the center
// tile.
//
// Helpers in this file are pure — they take grid bounds and a `(direction,
// offset)` pair and return cell coordinates / cell-key strings. They do
// not consult `G`, `RandomAPI`, or any bgio plumbing. The resolver in
// `./resolver.ts` is the single consumer.
//
// Direction conventions (kept in one place so consumers don't drift):
//   - `N`: threat enters from the north (high `y`), walks south toward
//     `y = 0`. Path cells are at `(offset, k)` for k from `bounds.maxY`
//     down to 0 inclusive.
//   - `S`: threat enters from the south (low `y`), walks north toward
//     `y = 0`. Path cells are at `(offset, k)` for k from `bounds.minY`
//     up to 0 inclusive.
//   - `E`: threat enters from the east (high `x`), walks west toward
//     `x = 0`. Path cells are at `(k, offset)` for k from `bounds.maxX`
//     down to 0 inclusive.
//   - `W`: threat enters from the west (low `x`), walks east toward
//     `x = 0`. Path cells are at `(k, offset)` for k from `bounds.minX`
//     up to 0 inclusive.
//
// `offset` is the perpendicular axis: for N/S threats, `offset` is the
// column (`x` value); for E/W threats, `offset` is the row (`y` value).
// The center tile `(0, 0)` is *always* the last cell in the returned
// list — paths always terminate at center per spec §3.

import type { Direction } from '../../data/schema.ts';
import type { DomesticBuilding } from '../roles/domestic/types.ts';
import { cellKey } from '../roles/domestic/grid.ts';

export interface GridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Cell {
  x: number;
  y: number;
}

/**
 * Compute the bounds the path geometry should walk against. We use the
 * "current min/max occupied + 1" rule from the spec so threats start one
 * step beyond the populated grid — a threat with no buildings on its
 * column/row still has a non-trivial entry point that walks through one
 * empty cell before terminating at center.
 *
 * The center tile at `(0, 0)` is always present, so the bounds are at
 * least `{-1, 1, -1, 1}`.
 */
export const computeGridBounds = (
  grid: Record<string, DomesticBuilding>,
): GridBounds => {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const key of Object.keys(grid)) {
    const parts = key.split(',');
    if (parts.length !== 2) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Add a one-cell margin so the entry point sits just outside the
  // populated grid.
  return {
    minX: minX - 1,
    maxX: maxX + 1,
    minY: minY - 1,
    maxY: maxY + 1,
  };
};

/**
 * The ordered path the threat traverses, from entry-point (first cell)
 * to center (last cell, always `(0, 0)`).
 *
 * The returned list always ends with the center tile. For N/E threats
 * we walk from the high edge of the bounds down toward 0; for S/W from
 * the low edge up toward 0. The center is appended once at the end.
 *
 * The path includes the entry cell (the first one outside the populated
 * grid) and every cell up to and including center.
 */
export const computePath = (
  direction: Direction,
  offset: number,
  bounds: GridBounds,
): Cell[] => {
  const path: Cell[] = [];
  switch (direction) {
    case 'N': {
      // Threats from the north walk south along x = offset, y from
      // bounds.maxY down to 0.
      const startY = bounds.maxY > 0 ? bounds.maxY : 1;
      for (let y = startY; y >= 0; y--) {
        path.push({ x: offset, y });
      }
      break;
    }
    case 'S': {
      const startY = bounds.minY < 0 ? bounds.minY : -1;
      for (let y = startY; y <= 0; y++) {
        path.push({ x: offset, y });
      }
      break;
    }
    case 'E': {
      const startX = bounds.maxX > 0 ? bounds.maxX : 1;
      for (let x = startX; x >= 0; x--) {
        path.push({ x, y: offset });
      }
      break;
    }
    case 'W': {
      const startX = bounds.minX < 0 ? bounds.minX : -1;
      for (let x = startX; x <= 0; x++) {
        path.push({ x, y: offset });
      }
      break;
    }
  }
  return path;
};

/**
 * Subset of the path that has buildings placed on it (excluding the
 * center tile — the resolver treats center separately as the terminal
 * pool-burn target). Returns the matching cell-key strings in path
 * order, so the resolver can iterate them as "first impact, then next
 * impact, then …" before reaching center.
 *
 * The center tile is identified by `isCenter === true` rather than by
 * coordinates so a future move of the center anchor doesn't break this
 * helper.
 */
export const occupiedPath = (
  path: ReadonlyArray<Cell>,
  grid: Record<string, DomesticBuilding>,
): string[] => {
  const out: string[] = [];
  for (const cell of path) {
    const key = cellKey(cell.x, cell.y);
    const placed = grid[key];
    if (placed === undefined) continue;
    if (placed.isCenter === true) continue;
    out.push(key);
  }
  return out;
};

/**
 * Chebyshev distance — max of |dx|, |dy|. Two cells at the same
 * coordinate have distance 0; orthogonally / diagonally adjacent cells
 * have distance 1.
 */
const chebyshev = (a: Cell, b: Cell): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * `true` iff the unit's tile is within firing reach of any cell on the
 * path. `range` is the count of tiles the unit can reach starting from
 * its own cell — `range = 1` covers only the unit's own tile,
 * `range = 2` covers the unit's tile + the 8-neighbour ring, etc. The
 * effective Chebyshev radius is therefore `range - 1`.
 */
export const tileCoversPath = (
  unitTile: Cell,
  range: number,
  path: ReadonlyArray<Cell>,
): boolean => {
  if (range < 1) return false;
  const radius = range - 1;
  for (const cell of path) {
    if (chebyshev(unitTile, cell) <= radius) return true;
  }
  return false;
};

/**
 * Parse a `cellKey` string back into a `Cell`. Returns `null` on
 * malformed input rather than throwing — the resolver consults this for
 * unit positions, and a corrupt key should fail soft (the unit just
 * doesn't fire) rather than crash the move.
 */
export const parseCellKey = (key: string): Cell | null => {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
};
