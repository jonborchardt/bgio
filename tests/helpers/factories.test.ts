// 12.1 — Tests for the high-level state factories.
//
// Each factory must produce a state that satisfies the resource-no-negative
// invariant. We also check the 4-player shape since that's the trickiest
// path through `setup` (every role gets its own seat, no role-stacking).

import { describe, expect, it } from 'vitest';
import {
  seedAfterChiefDistribute,
  seedFreshGame,
  seedMidScienceProgress,
  seedWithBuilding,
  seedWithUnit,
} from './factories.ts';
import { assertNoNegativeResources } from './assertConservation.ts';
import { BUILDINGS, UNITS } from '../../src/data/index.ts';

describe('seedFreshGame', () => {
  it('returns a state shape that matches setup() for 2 players', () => {
    const G = seedFreshGame(2);
    expect(G.bank).toBeDefined();
    expect(G.mats).toBeDefined();
    expect(G.roleAssignments).toBeDefined();
    expect(G.science).toBeDefined();
    expect(G.foreign).toBeDefined();
    expect(G.domestic).toBeDefined();
    expect(G.events).toBeDefined();
    expect(G.opponent).toBeDefined();
    expect(typeof G.round).toBe('number');
  });

  it('passes assertNoNegativeResources at numPlayers=2', () => {
    expect(() => assertNoNegativeResources(seedFreshGame(2))).not.toThrow();
  });

  it('produces 4 seats with role assignments at numPlayers=4', () => {
    const G = seedFreshGame(4);
    const seats = Object.keys(G.roleAssignments);
    expect(seats.sort()).toEqual(['0', '1', '2', '3']);
    // Each seat holds at least one role.
    for (const seat of seats) {
      expect(G.roleAssignments[seat]?.length).toBeGreaterThan(0);
    }
  });

  it('passes assertNoNegativeResources at numPlayers=4', () => {
    expect(() => assertNoNegativeResources(seedFreshGame(4))).not.toThrow();
  });
});

describe('seedAfterChiefDistribute', () => {
  it('with no partial returns a clean fresh state', () => {
    const G = seedAfterChiefDistribute();
    expect(() => assertNoNegativeResources(G)).not.toThrow();
  });

  it('drops resources into the named seat stash slots', () => {
    const G = seedFreshGame(2);
    // Pick the first non-chief seat as our target.
    const targetSeat = Object.keys(G.mats)[0];
    expect(targetSeat).toBeDefined();
    const distributed = seedAfterChiefDistribute({
      [targetSeat as string]: { gold: 2, wood: 1 },
    });
    expect(distributed.mats[targetSeat as string]?.stash.gold).toBe(2);
    expect(distributed.mats[targetSeat as string]?.stash.wood).toBe(1);
    expect(() => assertNoNegativeResources(distributed)).not.toThrow();
  });
});

describe('seedWithBuilding', () => {
  it('places the building on the grid at the requested cell', () => {
    const def = BUILDINGS[0];
    expect(def).toBeDefined();
    const G = seedWithBuilding(def!.name, 2, 3);
    expect(G.domestic?.grid['2,3']).toEqual({
      defID: def!.name,
      upgrades: 0,
      worker: null,
    });
    expect(() => assertNoNegativeResources(G)).not.toThrow();
  });

  it('throws on an unknown building defID', () => {
    expect(() => seedWithBuilding('does-not-exist', 0, 0)).toThrow(/unknown/);
  });
});

describe('seedWithUnit', () => {
  it('appends a UnitInstance with the given count', () => {
    const def = UNITS[0];
    expect(def).toBeDefined();
    const G = seedWithUnit(def!.name, 2);
    const row = G.foreign?.inPlay.find((u) => u.defID === def!.name);
    expect(row).toBeDefined();
    expect(row!.count).toBe(2);
    expect(() => assertNoNegativeResources(G)).not.toThrow();
  });

  it('increments count when called twice for the same defID', () => {
    const def = UNITS[0];
    const G = seedWithUnit(def!.name, 1);
    seedWithUnit(def!.name, 2, G);
    const row = G.foreign?.inPlay.find((u) => u.defID === def!.name);
    expect(row?.count).toBe(3);
  });
});

describe('seedMidScienceProgress', () => {
  it('credits the named card with the supplied paid bag', () => {
    const G = seedFreshGame(2);
    // Pick any one card id from the science grid.
    const cardId = Object.keys(G.science!.paid)[0];
    expect(cardId).toBeDefined();
    seedMidScienceProgress(cardId as string, { science: 1, gold: 2 }, G);
    expect(G.science!.paid[cardId as string]?.science).toBe(1);
    expect(G.science!.paid[cardId as string]?.gold).toBe(2);
    expect(() => assertNoNegativeResources(G)).not.toThrow();
  });
});
