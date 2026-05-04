// Tests for 06.1 Domestic grid helpers + setupDomestic.
//
// These exercise the pure module under `src/game/roles/domestic/grid.ts`
// without booting boardgame.io — the helpers are state-shape-free, so the
// tests can hand-build a `Record<string, DomesticBuilding>` and assert
// against the placement / adjacency predicates directly.

import { describe, expect, it } from 'vitest';
import {
  CENTER_CELL_KEY,
  CENTER_DEF_ID,
  cellKey,
  isOrthogonallyAdjacent,
  isPlacementLegal,
  setupDomestic,
} from '../../../src/game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';

const building = (defID: string): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp: 1,
  maxHp: 1,
});

const centerCell = (): DomesticBuilding => ({
  defID: CENTER_DEF_ID,
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
});

describe('cellKey', () => {
  it('is stable: same coords always produce the same key', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(cellKey(2, 3)).toBe(cellKey(2, 3));
  });

  it('distinguishes different coordinates', () => {
    expect(cellKey(0, 0)).not.toBe(cellKey(0, 1));
    expect(cellKey(1, 0)).not.toBe(cellKey(0, 1));
    expect(cellKey(-1, 5)).toBe('-1,5');
  });
});

describe('isOrthogonallyAdjacent', () => {
  it('returns true for the four orthogonal neighbours of a cell', () => {
    expect(isOrthogonallyAdjacent('0,0', '1,0')).toBe(true);
    expect(isOrthogonallyAdjacent('0,0', '-1,0')).toBe(true);
    expect(isOrthogonallyAdjacent('0,0', '0,1')).toBe(true);
    expect(isOrthogonallyAdjacent('0,0', '0,-1')).toBe(true);
  });

  it('returns false for diagonals and same-cell', () => {
    expect(isOrthogonallyAdjacent('0,0', '1,1')).toBe(false);
    expect(isOrthogonallyAdjacent('0,0', '0,0')).toBe(false);
    expect(isOrthogonallyAdjacent('0,0', '2,0')).toBe(false);
  });

  it('returns false for malformed keys (defensive)', () => {
    expect(isOrthogonallyAdjacent('0,0', 'oops')).toBe(false);
    expect(isOrthogonallyAdjacent('1,2,3', '0,0')).toBe(false);
  });
});

describe('isPlacementLegal', () => {
  it('first placement at any cell is legal on an empty grid', () => {
    const grid: Record<string, DomesticBuilding> = {};
    expect(isPlacementLegal(grid, 0, 0)).toBe(true);
    expect(isPlacementLegal(grid, 5, 5)).toBe(true);
    expect(isPlacementLegal(grid, -3, 7)).toBe(true);
  });

  it('subsequent placements require orthogonal adjacency to an existing cell', () => {
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('farm'),
    };
    // Adjacent to (0,0) — legal.
    expect(isPlacementLegal(grid, 1, 0)).toBe(true);
    expect(isPlacementLegal(grid, 0, 1)).toBe(true);
    expect(isPlacementLegal(grid, -1, 0)).toBe(true);
    expect(isPlacementLegal(grid, 0, -1)).toBe(true);

    // Not adjacent — illegal.
    expect(isPlacementLegal(grid, 5, 5)).toBe(false);
    expect(isPlacementLegal(grid, 1, 1)).toBe(false); // diagonal only
    expect(isPlacementLegal(grid, 2, 0)).toBe(false); // distance-2
  });

  it('placement on an already-occupied cell is illegal', () => {
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('farm'),
    };
    expect(isPlacementLegal(grid, 0, 0)).toBe(false);
  });

  it('adjacency search considers any existing cell, not just the most recent', () => {
    // (0,0) and (5,5) — separate clusters. (5,4) and (5,6) should be
    // adjacent to the (5,5) cluster, while (4,4) is diagonal to (5,5)
    // and not adjacent to (0,0), so it's illegal.
    const grid: Record<string, DomesticBuilding> = {
      [cellKey(0, 0)]: building('farm'),
      [cellKey(5, 5)]: building('mine'),
    };
    expect(isPlacementLegal(grid, 5, 4)).toBe(true);
    expect(isPlacementLegal(grid, 5, 6)).toBe(true);
    expect(isPlacementLegal(grid, 4, 4)).toBe(false);
  });
});

describe('setupDomestic', () => {
  it('seeds the grid with exactly the village-vault center tile at (0,0)', () => {
    // Defense redesign D2 — the only cell on a freshly-set-up grid is the
    // synthetic center tile at (0, 0), flagged `isCenter: true`. Phase 1.3
    // will reserve `hp` / `maxHp` on every domestic building (including
    // this one); for 1.2 the center carries the minimum shape.
    const state = setupDomestic();
    expect(Object.keys(state.grid)).toEqual([CENTER_CELL_KEY]);
    const center = state.grid[CENTER_CELL_KEY];
    expect(center).toBeDefined();
    expect(center!.isCenter).toBe(true);
    expect(center!.defID).toBe(CENTER_DEF_ID);
    expect(center!.worker).toBeNull();
    expect(center!.upgrades).toBe(0);
  });

  it('returns a non-empty hand of buildings', () => {
    const state = setupDomestic();
    expect(state.hand.length).toBeGreaterThan(0);
    // Every entry should be a BuildingDef-shaped object — sanity check on
    // the keys we expect, without locking the test to a specific count.
    for (const b of state.hand) {
      expect(typeof b.name).toBe('string');
      expect(typeof b.cost).toBe('number');
    }
  });

  it('does NOT seed the synthetic Center def into the buyable hand', () => {
    // Recommendation (b) from the sub-phase plan: Center is hard-coded
    // into setup, NOT a real BuildingDef. It must never appear in the
    // domestic hand — otherwise a player could "buy" it.
    const state = setupDomestic();
    expect(state.hand.find((b) => b.name === CENTER_DEF_ID)).toBeUndefined();
  });

  it('accepts an optional `techsAlreadyUsedBy` set without error', () => {
    // The hand is BuildingDef[] today, so the set has no effect on the
    // result; the assertion is shape-only. (The set is reserved for
    // future filtering once the hand widens to include TechnologyDef-
    // derived buildings — see `setupDomestic`'s doc comment.)
    const used = new Set(['Pottery', 'Wheel', 'Writing']);
    const a = setupDomestic(used);
    const b = setupDomestic();
    expect(a.hand.length).toBe(b.hand.length);
    // Both grids carry the same single center tile.
    expect(Object.keys(a.grid)).toEqual([CENTER_CELL_KEY]);
    expect(Object.keys(b.grid)).toEqual([CENTER_CELL_KEY]);
  });
});

describe('center-tile placement integration (defense redesign D2)', () => {
  // The center tile at (0, 0) is the always-present anchor for the first
  // real placement. Because `isPlacementLegal` already (a) rejects placing
  // on an occupied cell and (b) accepts any cell orthogonally adjacent to
  // an existing one, no code change to that helper was required — the
  // center's existence drives the desired behavior on its own.
  const seededGrid = (): Record<string, DomesticBuilding> => ({
    [CENTER_CELL_KEY]: centerCell(),
  });

  it('first real placement at (1, 0) is legal (orthogonally adjacent to center)', () => {
    expect(isPlacementLegal(seededGrid(), 1, 0)).toBe(true);
  });

  it('first real placement at (0, 1), (0, -1), (-1, 0) are all legal', () => {
    const grid = seededGrid();
    expect(isPlacementLegal(grid, 0, 1)).toBe(true);
    expect(isPlacementLegal(grid, 0, -1)).toBe(true);
    expect(isPlacementLegal(grid, -1, 0)).toBe(true);
  });

  it('first real placement at (2, 0) is rejected — not adjacent to center', () => {
    expect(isPlacementLegal(seededGrid(), 2, 0)).toBe(false);
  });

  it('first real placement at (1, 1) is rejected — diagonal to center', () => {
    expect(isPlacementLegal(seededGrid(), 1, 1)).toBe(false);
  });

  it('placement on the center cell (0, 0) is rejected — already occupied', () => {
    // The center tile is permanent; an explicit reject here matches the
    // "hardening" note in the sub-phase plan.
    expect(isPlacementLegal(seededGrid(), 0, 0)).toBe(false);
  });

  it('after a first real building at (1, 0), a second build at (1, 1) is legal (adjacent to that building)', () => {
    const grid: Record<string, DomesticBuilding> = {
      ...seededGrid(),
      [cellKey(1, 0)]: building('Granary'),
    };
    expect(isPlacementLegal(grid, 1, 1)).toBe(true);
    // And a non-adjacent cluster cell is still rejected.
    expect(isPlacementLegal(grid, 5, 5)).toBe(false);
  });

  it('the center tile cannot be replaced or overwritten', () => {
    // setupDomestic seeds it; subsequent placement at (0,0) is rejected
    // because the cell is occupied. There is no code path that mutates
    // `defID` of an existing cell — but assert via the placement-legal
    // check that (0, 0) stays off-limits even with an empty-looking
    // surrounding grid.
    const state = setupDomestic();
    expect(isPlacementLegal(state.grid, 0, 0)).toBe(false);
    expect(state.grid[CENTER_CELL_KEY]?.isCenter).toBe(true);
  });
});
