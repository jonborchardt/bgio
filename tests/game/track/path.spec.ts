// Defense redesign 2.3 — pure-geometry tests for the threat-path helpers.
//
// We hand-build small synthetic grids and cards so the assertions read
// like rules: "an N threat at offset 0 walks down x=0 to center."

import { describe, expect, it } from 'vitest';
import {
  computeGridBounds,
  computePath,
  occupiedPath,
  parseCellKey,
  tileCoversPath,
} from '../../../src/game/track/path.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import { CENTER_CELL_KEY, cellKey } from '../../../src/game/roles/domestic/grid.ts';

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const placed = (defID: string, hp = 2): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp,
  maxHp: hp,
});

describe('computeGridBounds', () => {
  it('returns at least { -1, 1, -1, 1 } for a center-only grid', () => {
    const grid: Record<string, DomesticBuilding> = {
      [CENTER_CELL_KEY]: center,
    };
    const b = computeGridBounds(grid);
    expect(b.minX).toBeLessThanOrEqual(-1);
    expect(b.maxX).toBeGreaterThanOrEqual(1);
    expect(b.minY).toBeLessThanOrEqual(-1);
    expect(b.maxY).toBeGreaterThanOrEqual(1);
  });

  it('expands by one beyond the populated extent', () => {
    const grid: Record<string, DomesticBuilding> = {
      [CENTER_CELL_KEY]: center,
      [cellKey(2, 0)]: placed('Mill'),
      [cellKey(0, 3)]: placed('Tower'),
    };
    const b = computeGridBounds(grid);
    expect(b.maxX).toBe(3);
    expect(b.maxY).toBe(4);
    expect(b.minX).toBe(-1);
    expect(b.minY).toBe(-1);
  });
});

describe('computePath', () => {
  it('N at offset 0 walks down x=0 column toward (0,0)', () => {
    const path = computePath('N', 0, {
      minX: -1,
      maxX: 1,
      minY: -1,
      maxY: 2,
    });
    // Starts at (0, 2) and walks to (0, 0).
    expect(path[0]).toEqual({ x: 0, y: 2 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 0 });
    // Every cell on x=0 in monotonically decreasing y.
    for (const c of path) expect(c.x).toBe(0);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]!.y).toBeLessThan(path[i - 1]!.y);
    }
  });

  it('S at offset 1 walks up x=1 toward (1,0)', () => {
    const path = computePath('S', 1, {
      minX: -2,
      maxX: 2,
      minY: -2,
      maxY: 1,
    });
    expect(path[0]).toEqual({ x: 1, y: -2 });
    expect(path[path.length - 1]).toEqual({ x: 1, y: 0 });
    for (const c of path) expect(c.x).toBe(1);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]!.y).toBeGreaterThan(path[i - 1]!.y);
    }
  });

  it('E at offset 0 walks left along y=0', () => {
    const path = computePath('E', 0, {
      minX: -1,
      maxX: 3,
      minY: -1,
      maxY: 1,
    });
    expect(path[0]).toEqual({ x: 3, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 0 });
    for (const c of path) expect(c.y).toBe(0);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]!.x).toBeLessThan(path[i - 1]!.x);
    }
  });

  it('W at offset -1 walks right along y=-1', () => {
    const path = computePath('W', -1, {
      minX: -3,
      maxX: 1,
      minY: -2,
      maxY: 1,
    });
    expect(path[0]).toEqual({ x: -3, y: -1 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: -1 });
    for (const c of path) expect(c.y).toBe(-1);
  });

  it('every direction terminates at (0,0) on the matching axis', () => {
    const bounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    expect(computePath('N', 0, bounds).slice(-1)[0]).toEqual({ x: 0, y: 0 });
    expect(computePath('S', 0, bounds).slice(-1)[0]).toEqual({ x: 0, y: 0 });
    expect(computePath('E', 0, bounds).slice(-1)[0]).toEqual({ x: 0, y: 0 });
    expect(computePath('W', 0, bounds).slice(-1)[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('occupiedPath', () => {
  it('returns only non-center tiles in path order', () => {
    const grid: Record<string, DomesticBuilding> = {
      [CENTER_CELL_KEY]: center,
      [cellKey(0, 1)]: placed('Mill'),
      [cellKey(0, 2)]: placed('Tower'),
    };
    const path = computePath('N', 0, computeGridBounds(grid));
    const occupied = occupiedPath(path, grid);
    // Path walks y=2 → 0; occupied (excluding center) is [0,2 then 0,1].
    expect(occupied).toEqual([cellKey(0, 2), cellKey(0, 1)]);
  });

  it('excludes the center even when the threat would terminate there', () => {
    const grid: Record<string, DomesticBuilding> = {
      [CENTER_CELL_KEY]: center,
    };
    const path = computePath('N', 0, computeGridBounds(grid));
    const occupied = occupiedPath(path, grid);
    expect(occupied).toEqual([]);
  });
});

describe('tileCoversPath', () => {
  it('returns true when the unit is on a path cell', () => {
    const path = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
    expect(tileCoversPath({ x: 0, y: 0 }, 0, path)).toBe(true);
  });

  it('Chebyshev range 1 covers a diagonal neighbour of any path cell', () => {
    const path = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
    expect(tileCoversPath({ x: 1, y: 1 }, 1, path)).toBe(true);
    expect(tileCoversPath({ x: -1, y: 2 }, 1, path)).toBe(true);
  });

  it('returns false when the unit is out of range of every cell', () => {
    const path = [{ x: 0, y: 0 }];
    expect(tileCoversPath({ x: 3, y: 0 }, 1, path)).toBe(false);
  });

  it('a negative range never covers anything', () => {
    expect(tileCoversPath({ x: 0, y: 0 }, -1, [{ x: 0, y: 0 }])).toBe(false);
  });
});

describe('parseCellKey', () => {
  it('returns numeric (x, y) for valid keys', () => {
    expect(parseCellKey('0,0')).toEqual({ x: 0, y: 0 });
    expect(parseCellKey('-2,3')).toEqual({ x: -2, y: 3 });
  });
  it('returns null for malformed keys', () => {
    expect(parseCellKey('foo')).toBeNull();
    expect(parseCellKey('1,2,3')).toBeNull();
    expect(parseCellKey('a,b')).toBeNull();
  });
});
