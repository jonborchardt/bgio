// 14.10 — allocator tests.

import { describe, expect, it } from 'vitest';
import {
  discoverIncomingEvents,
  greedyAllocation,
  playerRowsFor,
  sumAllocation,
} from '../../../src/ui/foreign/allocator.ts';
import { UNITS } from '../../../src/data/index.ts';

describe('greedyAllocation (14.10)', () => {
  it('returns empty for incoming=0', () => {
    expect(greedyAllocation([], 0)).toEqual({ byUnit: {} });
  });

  it('returns null when totalHp < incoming', () => {
    const rows = [{ defID: 'Brute', totalHp: 3, count: 1 }];
    expect(greedyAllocation(rows, 5)).toBeNull();
  });

  it('kills the lowest-HP defID first', () => {
    const rows = [
      { defID: 'Brute', totalHp: 6, count: 1 },
      { defID: 'Scout', totalHp: 2, count: 1 },
    ];
    const out = greedyAllocation(rows, 2);
    expect(out).toEqual({ byUnit: { Scout: 2 } });
  });

  it('partial leftover lands on highest-HP defID', () => {
    const rows = [
      { defID: 'Brute', totalHp: 6, count: 1 },
      { defID: 'Scout', totalHp: 2, count: 1 },
    ];
    const out = greedyAllocation(rows, 5);
    // Scout fully absorbs (2), Brute takes leftover (3).
    expect(out).toEqual({ byUnit: { Scout: 2, Brute: 3 } });
  });

  it('sumAllocation: counts every defID', () => {
    expect(sumAllocation({ byUnit: { Brute: 2, Scout: 1 } })).toBe(3);
  });
});

describe('playerRowsFor (14.10)', () => {
  it('drops zero-count entries and computes totalHp from UNITS', () => {
    const brute = UNITS.find((u) => u.name === 'Brute')!;
    const rows = playerRowsFor([
      { defID: 'Brute', count: 2 },
      { defID: 'NeverExisted', count: 0 },
    ]);
    expect(rows).toEqual([
      { defID: 'Brute', totalHp: brute.hp * 2, count: 2 },
    ]);
  });
});

describe('discoverIncomingEvents (14.10)', () => {
  it('1 enemy vs 1 player → 1 incoming event of enemy attack', () => {
    // Pick a 1-attack enemy and a player unit with enough HP to survive
    // one hit. Use synthetic UnitDef lookups to keep the test stable
    // against UNITS data churn.
    const enemyDef = {
      name: 'TestGoblin',
      cost: 1,
      requires: '',
      attack: 1,
      hp: 1,
      initiative: 1,
      altStats: '',
      note: '',
      range: 1,
      regen: 0,
      firstStrike: false,
      placementBonus: [],
    };
    const playerDef = {
      name: 'TestKnight',
      cost: 1,
      attack: 1,
      hp: 3,
      requires: '',
      initiative: 0, // enemy goes first
      altStats: '',
      note: '',
      range: 1,
      regen: 0,
      firstStrike: false,
      placementBonus: [],
    };
    const lookup = (id: string) =>
      id === 'TestGoblin'
        ? enemyDef
        : id === 'TestKnight'
          ? playerDef
          : undefined;

    const events = discoverIncomingEvents({
      player: [{ defID: 'TestKnight', count: 1 }],
      enemy: [{ defID: 'TestGoblin', count: 1 }],
      enemyDamageRule: 'attacksClosest',
      unitLookup: lookup,
    });

    // TestGoblin acts first (initiative 1 vs 0) and hits the knight for
    // 1. Then knight kills goblin with its 1 attack. Only 1 incoming
    // event.
    expect(events.length).toBe(1);
    expect(events[0]!.incoming).toBe(1);
    expect(events[0]!.defaultAllocation).toEqual({
      byUnit: { TestKnight: 1 },
    });
  });

  it('returns 0 events when enemy is empty', () => {
    const events = discoverIncomingEvents({
      player: [{ defID: 'Brute', count: 1 }],
      enemy: [],
      enemyDamageRule: 'attacksClosest',
    });
    expect(events).toEqual([]);
  });
});
