// SL 4 — boss debuff threshold tests.

import { describe, expect, it } from 'vitest';
import {
  libraryDebuffLevel,
  aggregateLibraryDebuffs,
  totalDebuffReduction,
} from '../../../src/game/library/debuff.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  BuildingDef,
  LibraryColor,
} from '../../../src/data/schema.ts';
import { seedFreshGame } from '../../helpers/factories.ts';
import { emptyLibraryState } from '../../../src/game/library/state.ts';

const fakeBuilding = (suffix: string): BuildingDef => ({
  name: `Fake-${suffix}`,
  cost: 1,
  benefit: '',
  note: '',
  maxHp: 1,
});

const card = (color: LibraryColor, suffix = '0'): LibraryCard => ({
  kind: 'building',
  tier: 1,
  scienceColor: color,
  def: fakeBuilding(`${color}-${suffix}`),
});

const repeat = (color: LibraryColor, n: number): LibraryCard[] => {
  const out: LibraryCard[] = [];
  for (let i = 0; i < n; i += 1) out.push(card(color, String(i)));
  return out;
};

describe('libraryDebuffLevel', () => {
  it('returns 0 below 5 of the color', () => {
    expect(libraryDebuffLevel([], 'gold')).toBe(0);
    expect(libraryDebuffLevel(repeat('gold', 4), 'gold')).toBe(0);
  });

  it('returns 1 at exactly 5', () => {
    expect(libraryDebuffLevel(repeat('blue', 5), 'blue')).toBe(1);
  });

  it('returns 1 between 5 and 9', () => {
    expect(libraryDebuffLevel(repeat('green', 9), 'green')).toBe(1);
  });

  it('returns 2 at exactly 10', () => {
    expect(libraryDebuffLevel(repeat('red', 10), 'red')).toBe(2);
  });

  it('returns 2 between 10 and 14', () => {
    expect(libraryDebuffLevel(repeat('gold', 14), 'gold')).toBe(2);
  });

  it('returns 3 at exactly 15', () => {
    expect(libraryDebuffLevel(repeat('blue', 15), 'blue')).toBe(3);
  });

  it('returns 3 above 15 (clamped at 3)', () => {
    expect(libraryDebuffLevel(repeat('green', 30), 'green')).toBe(3);
  });

  it('only counts the asked-for color in a mixed tableau', () => {
    const tableau: LibraryCard[] = [
      ...repeat('gold', 5),
      ...repeat('blue', 10),
      ...repeat('red', 2),
    ];
    expect(libraryDebuffLevel(tableau, 'gold')).toBe(1);
    expect(libraryDebuffLevel(tableau, 'blue')).toBe(2);
    expect(libraryDebuffLevel(tableau, 'red')).toBe(0);
    expect(libraryDebuffLevel(tableau, 'green')).toBe(0);
  });
});

describe('aggregateLibraryDebuffs', () => {
  it('returns all zeros when G.library is undefined', () => {
    const G = seedFreshGame(2);
    G.library = undefined;
    expect(aggregateLibraryDebuffs(G)).toEqual({
      gold: 0,
      blue: 0,
      green: 0,
      red: 0,
    });
  });

  it('returns all zeros on a fresh empty library', () => {
    const G = seedFreshGame(2);
    G.library = emptyLibraryState(['0', '1']);
    expect(aggregateLibraryDebuffs(G)).toEqual({
      gold: 0,
      blue: 0,
      green: 0,
      red: 0,
    });
  });

  it('counts a single seat with mixed colors', () => {
    const G = seedFreshGame(2);
    const lib = emptyLibraryState(['0', '1']);
    lib.discountTableaus['0'] = [
      ...repeat('gold', 5),
      ...repeat('blue', 10),
    ];
    G.library = lib;
    expect(aggregateLibraryDebuffs(G)).toEqual({
      gold: 1,
      blue: 2,
      green: 0,
      red: 0,
    });
  });

  it('aggregates across multiple seats', () => {
    const G = seedFreshGame(2);
    const lib = emptyLibraryState(['0', '1']);
    // Per the master plan, only science actually accumulates today, but
    // the shape is per-seat; this test pins that the aggregator sums
    // tableaus across every seat key.
    lib.discountTableaus['0'] = repeat('red', 3);
    lib.discountTableaus['1'] = repeat('red', 2);
    G.library = lib;
    expect(aggregateLibraryDebuffs(G).red).toBe(1);
  });

  it('clamps at level 3 even with 60 cards of one color', () => {
    const G = seedFreshGame(2);
    const lib = emptyLibraryState(['0']);
    lib.discountTableaus['0'] = repeat('green', 60);
    G.library = lib;
    expect(aggregateLibraryDebuffs(G).green).toBe(3);
  });
});

describe('totalDebuffReduction', () => {
  it('sums all four color levels', () => {
    expect(
      totalDebuffReduction({ gold: 1, blue: 2, green: 0, red: 3 }),
    ).toBe(6);
  });

  it('returns 0 on the all-zero shape', () => {
    expect(
      totalDebuffReduction({ gold: 0, blue: 0, green: 0, red: 0 }),
    ).toBe(0);
  });
});
