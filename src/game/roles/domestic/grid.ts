// 06.1 — Pure grid helpers + `setupDomestic`.
//
// `cellKey` is the canonical "x,y -> string" encoding used as Domestic grid
// keys. `isOrthogonallyAdjacent` and `isPlacementLegal` enforce the
// adjacency rule from game-design.md (Option 1: every placed building must
// touch an existing one orthogonally; the very first placement is free).
//
// `setupDomestic` is called from `src/game/setup.ts` and produces the
// initial `DomesticState` for the match.

import type { BuildingDef } from '../../../data/schema.ts';
import { BUILDINGS } from '../../../data/index.ts';
import type { DomesticBuilding, DomesticState } from './types.ts';

/** Canonical encoding for grid keys: `cellKey(2, 3) === '2,3'`. */
export const cellKey = (x: number, y: number): string => `${x},${y}`;

/**
 * `true` iff the two grid keys describe orthogonally-adjacent cells —
 * i.e. their Manhattan distance is exactly 1 (diagonals do not count).
 *
 * Either argument may be malformed; in that case we return `false`
 * defensively rather than throwing, because the helper is also used in
 * placement-legality checks where bad input means "not legal" anyway.
 */
export const isOrthogonallyAdjacent = (a: string, b: string): boolean => {
  const parse = (k: string): [number, number] | null => {
    const parts = k.split(',');
    if (parts.length !== 2) return null;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y];
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa === null || pb === null) return false;
  const [ax, ay] = pa;
  const [bx, by] = pb;
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/**
 * Validates that placing a building at `(x, y)` is legal:
 *   - the cell must currently be empty;
 *   - if the grid is empty, any cell is legal;
 *   - otherwise the cell must be orthogonally adjacent to at least one
 *     existing key in the grid.
 *
 * Pure — does not mutate `grid`.
 */
export const isPlacementLegal = (
  grid: Record<string, DomesticBuilding>,
  x: number,
  y: number,
): boolean => {
  const target = cellKey(x, y);
  if (Object.prototype.hasOwnProperty.call(grid, target)) return false;

  const keys = Object.keys(grid);
  if (keys.length === 0) return true;

  for (const k of keys) {
    if (isOrthogonallyAdjacent(target, k)) return true;
  }
  return false;
};

/**
 * Builds the initial Domestic state at game-start.
 *
 * The plan says "level-0 tech cards from `TECHNOLOGIES`", but the API in
 * the same plan declares `hand: BuildingDef[]`. We follow the API: the
 * Domestic hand is a pile of buildings (the placeable pool), not tech
 * cards. `BuildingDef` does not currently expose a level field, so we
 * include every entry in `BUILDINGS` as the starter pile — that matches
 * the design intent that all baseline buildings are available from the
 * start, with tech-gated buildings layered in later via `techHand`.
 *
 * `techsAlreadyUsedBy` is accepted for API parity with the plan and for
 * future-proofing: when the hand grows to mix in tech-derived buildings,
 * we'll filter against this set to avoid duplicating techs already taken
 * by other roles' Science under-card stacks. Today it's reserved.
 *
 * @param techsAlreadyUsedBy - optional set of TechnologyDef.name values
 *   that have been claimed elsewhere (typically derived by flattening
 *   `G.science.underCards` in `setup.ts`). Reserved for filtering once
 *   the hand mixes BuildingDef and TechnologyDef.
 */
export const setupDomestic = (
  techsAlreadyUsedBy?: Set<string>,
): DomesticState => {
  // `BUILDINGS` is a frozen ReadonlyArray — copy into a fresh mutable list
  // so callers can shuffle / filter without tripping the freeze.
  const hand: BuildingDef[] = [...BUILDINGS];

  // Reserved-for-future filter; today the hand has no TechnologyDef
  // entries, so the set has no effect. Reference the parameter so strict
  // TypeScript doesn't flag it as unused once the hand union widens.
  void techsAlreadyUsedBy;

  return {
    hand,
    grid: {},
  };
};
