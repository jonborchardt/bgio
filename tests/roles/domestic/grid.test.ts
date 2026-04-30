// Tests for 06.1 Domestic grid helpers + setupDomestic.
//
// These exercise the pure module under `src/game/roles/domestic/grid.ts`
// without booting boardgame.io — the helpers are state-shape-free, so the
// tests can hand-build a `Record<string, DomesticBuilding>` and assert
// against the placement / adjacency predicates directly.

import { describe, expect, it } from 'vitest';
import {
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
  it('returns an empty grid', () => {
    const state = setupDomestic();
    expect(state.grid).toEqual({});
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

  it('accepts an optional `techsAlreadyUsedBy` set without error', () => {
    // The hand is BuildingDef[] today, so the set has no effect on the
    // result; the assertion is shape-only. (The set is reserved for
    // future filtering once the hand widens to include TechnologyDef-
    // derived buildings — see `setupDomestic`'s doc comment.)
    const used = new Set(['Pottery', 'Wheel', 'Writing']);
    const a = setupDomestic(used);
    const b = setupDomestic();
    expect(a.hand.length).toBe(b.hand.length);
    expect(a.grid).toEqual({});
  });
});
