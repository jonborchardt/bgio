// Defense redesign 3.3 — resolver trace tests.
//
// Every flip resolved through `resolveTrackCard` should:
//   - publish a `ResolveTrace` onto `G.track.traces` (parallel-indexed
//     against `G.track.history`),
//   - update `G.track.lastResolve` to that trace,
//   - encode the threat's outcome accurately (`killed`, `overflowed`,
//     `reachedCenter`, `noop` for boon / modifier).
//
// The resolver mutations are exercised against synthetic grids so the
// assertions read like rules: "a Brute that one-shots an offset-0 threat
// produces a `killed` trace whose pathTiles cover entry → impact tile."

import { describe, expect, it } from 'vitest';
import { resolveTrackCard } from '../../../src/game/track/resolver.ts';
import type {
  BoonCard,
  ModifierCard,
  ThreatCard,
} from '../../../src/data/schema.ts';
import type { RandomAPI } from '../../../src/game/random.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';
import { CENTER_CELL_KEY, cellKey } from '../../../src/game/roles/domestic/grid.ts';
import { seedFreshGame } from '../../helpers/factories.ts';

const detRandom = (): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
  pickOne: <T>(arr: ReadonlyArray<T>): T => {
    if (arr.length === 0) throw new Error('detRandom.pickOne: empty');
    return arr[0]!;
  },
  rangeInt: (lo: number) => lo,
});

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const placedBuilding = (
  defID: string,
  hp: number,
  maxHp: number,
): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp,
  maxHp,
});

const unit = (
  partial: Partial<UnitInstance> & {
    id: string;
    defID: string;
    cellKey: string;
    hp: number;
    placementOrder: number;
  },
): UnitInstance => partial as UnitInstance;

const threat = (overrides: Partial<ThreatCard>): ThreatCard => ({
  id: 't-1',
  name: 'Test Threat',
  kind: 'threat',
  phase: 1,
  description: 'a test threat',
  direction: 'N',
  offset: 0,
  strength: 3,
  ...overrides,
} as ThreatCard);

const buildG = (units: UnitInstance[] = []): SettlementState => {
  const G = seedFreshGame(2);
  G.domestic = {
    hand: [],
    grid: {
      [CENTER_CELL_KEY]: center,
      [cellKey(0, 1)]: placedBuilding('Mill', 2, 2),
    },
  };
  G.defense = {
    hand: [],
    inPlay: units,
  };
  return G;
};

describe('resolveTrackCard — trace publication (3.3)', () => {
  it('publishes a `killed` trace when the threat dies to fire before impact', () => {
    const G = buildG([
      unit({
        id: 'u1',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
    ]);
    expect(G.track?.traces ?? []).toHaveLength(0);
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 2 }),
    );
    const traces = G.track?.traces ?? [];
    expect(traces).toHaveLength(1);
    const t = traces[0]!;
    expect(t.outcome).toBe('killed');
    expect(t.firingUnitIDs).toContain('u1');
    expect(t.impactTiles).toEqual([]);
    // Path covers the threat's walked region (entry → impact tile).
    expect(t.pathTiles.length).toBeGreaterThan(0);
    // The killed-en-route case still includes the first impact tile in
    // the path so the overlay can paint "the threat got this close
    // before going down."
    const lastCell = t.pathTiles[t.pathTiles.length - 1]!;
    expect(lastCell).toEqual({ x: 0, y: 1 });
    // lastResolve aliases the most recent push.
    expect(G.track?.lastResolve).toBe(t);
  });

  it('publishes an `overflowed` trace when the threat damages a building but is destroyed before center', () => {
    // Mill (hp 4 / maxHp 4) on the path absorbs the threat's full damage
    // before center. Scout (atk 1, hp 1) chips threat 3 → 2; Mill takes
    // 2 damage clamps the resolver before any leftover hits center;
    // Scout dies on repel.
    const G = buildG([
      unit({
        id: 'u1',
        defID: 'Scout',
        cellKey: cellKey(0, 1),
        hp: 1,
        placementOrder: 0,
      }),
    ]);
    // Beef up the Mill so the building absorbs every leftover unit and
    // the threat doesn't spill into center (would otherwise flip the
    // outcome to `reachedCenter`).
    G.domestic!.grid[cellKey(0, 1)] = placedBuilding('Mill', 4, 4);
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 3 }),
    );
    const t = G.track!.lastResolve!;
    expect(t.outcome).toBe('overflowed');
    expect(t.impactTiles).toEqual([cellKey(0, 1)]);
    expect(t.firingUnitIDs).toEqual(['u1']);
    // Path runs from entry cell to (and including) the impact tile.
    const lastCell = t.pathTiles[t.pathTiles.length - 1]!;
    expect(lastCell).toEqual({ x: 0, y: 1 });
  });

  it('publishes a `reachedCenter` trace with `centerBurned` set when the path ends at center', () => {
    const G = buildG([]);
    // Strip the Mill so the path is unobstructed — the threat hits
    // center directly.
    delete G.domestic!.grid[cellKey(0, 1)];
    // Seat 1 (the only non-chief mat in seedFreshGame(2)) needs stash
    // for the burn.
    const seat = Object.keys(G.mats)[0]!;
    G.mats[seat]!.stash.gold = 5;
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 2 }),
    );
    const t = G.track!.lastResolve!;
    expect(t.outcome).toBe('reachedCenter');
    expect(t.centerBurned).toBe(2);
    // Path ends at center.
    const lastCell = t.pathTiles[t.pathTiles.length - 1]!;
    expect(lastCell).toEqual({ x: 0, y: 0 });
    // Empty impact list — threat didn't damage any building.
    expect(t.impactTiles).toEqual([]);
  });

  it('publishes a `noop` trace for a boon flip', () => {
    const G = buildG([]);
    const boon: BoonCard = {
      kind: 'boon',
      id: 'boon-1',
      name: 'Foragers',
      phase: 1,
      description: 'a haul of wood',
      effect: { kind: 'gainResource', bag: { wood: 2 }, target: 'bank' },
    };
    resolveTrackCard(G, detRandom(), boon);
    const t = G.track!.lastResolve!;
    expect(t.outcome).toBe('noop');
    expect(t.pathTiles).toEqual([]);
    expect(t.impactTiles).toEqual([]);
    expect(t.firingUnitIDs).toEqual([]);
  });

  it('publishes a `noop` trace for a modifier flip', () => {
    const G = buildG([]);
    const mod: ModifierCard = {
      kind: 'modifier',
      id: 'mod-1',
      name: 'Calm Winds',
      phase: 1,
      description: 'science doubled',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    resolveTrackCard(G, detRandom(), mod);
    const t = G.track!.lastResolve!;
    expect(t.outcome).toBe('noop');
  });

  it('appends successive traces, parallel-indexed against history flips', () => {
    const G = buildG([]);
    expect((G.track?.traces ?? []).length).toBe(0);
    // Two boon flips → two `noop` traces.
    resolveTrackCard(G, detRandom(), {
      kind: 'boon',
      id: 'b1',
      name: 'b1',
      phase: 1,
      description: '',
      effect: { kind: 'gainResource', bag: { gold: 1 }, target: 'bank' },
    });
    resolveTrackCard(G, detRandom(), {
      kind: 'boon',
      id: 'b2',
      name: 'b2',
      phase: 1,
      description: '',
      effect: { kind: 'gainResource', bag: { gold: 1 }, target: 'bank' },
    });
    expect(G.track!.traces!.length).toBe(2);
    // lastResolve identity matches the freshly-pushed entry.
    expect(G.track!.lastResolve).toBe(G.track!.traces![1]);
  });

  it('boss flip publishes one trace per attack, not one per boss card', () => {
    const G = buildG([]);
    // Strip the Mill so each attack has an unobstructed path to center.
    delete G.domestic!.grid[cellKey(0, 1)];
    // Pre-seed stash so attacks have something to burn at center.
    const seat = Object.keys(G.mats)[0]!;
    G.mats[seat]!.stash.gold = 10;
    resolveTrackCard(G, detRandom(), {
      kind: 'boss',
      id: 'boss',
      name: 'The Last Settlement',
      phase: 10,
      description: '',
      baseAttacks: 3,
      thresholds: { science: 999, economy: 999, military: 999 },
      attackPattern: [
        { direction: 'N', offset: 0, strength: 1 },
        { direction: 'S', offset: 0, strength: 1 },
        { direction: 'E', offset: 0, strength: 1 },
      ],
    });
    // 3 attacks, 0 thresholds met → 3 synthetic threat resolves → 3
    // traces appended.
    expect((G.track?.traces ?? []).length).toBe(3);
    for (const t of G.track!.traces!) {
      expect(t.outcome).toBe('reachedCenter');
    }
  });
});
