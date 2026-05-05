// Defense redesign 2.3 — resolver pipeline tests.
//
// We exercise the threat / boon / modifier dispatch + the deterministic
// combat pipeline against synthetic SettlementState fixtures. Tests run
// over the resolver in isolation (no full bgio Client), using a tiny
// deterministic random stub when the resolver needs one.

import { describe, expect, it } from 'vitest';
import { resolveTrackCard } from '../../../src/game/track/resolver.ts';
import { centerBurn } from '../../../src/game/track/centerBurn.ts';
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

// Deterministic random — `pickOne` always picks index 0; `shuffle` is
// identity. Lets the center-burn / pool tests be exact about which seat
// and resource gets hit first.
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

// Threat factory — fills in benign defaults.
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

// Build a small SettlementState with center + one Mill at (0,1) and a
// configurable defense.inPlay.
const buildG = (units: UnitInstance[] = []): SettlementState => {
  const G = seedFreshGame(2);
  // Reset domestic grid to deterministic shape: center + Mill at (0,1).
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

describe('resolveTrackCard — boon / modifier dispatch', () => {
  it('boon (gainResource → bank) credits the bank', () => {
    const G = seedFreshGame(2);
    const before = G.bank.wood;
    const boon: BoonCard = {
      kind: 'boon',
      id: 'boon-1',
      name: 'Foragers',
      phase: 1,
      description: 'A small wood haul.',
      effect: { kind: 'gainResource', bag: { wood: 2 }, target: 'bank' },
    };
    resolveTrackCard(G, detRandom(), boon);
    expect(G.bank.wood).toBe(before + 2);
  });

  it('modifier card pushes onto G.track.activeModifiers and G._modifiers', () => {
    const G = seedFreshGame(2);
    const mod: ModifierCard = {
      kind: 'modifier',
      id: 'mod-1',
      name: 'Calm Winds',
      phase: 1,
      description: 'science doubled',
      durationRounds: 1,
      effect: { kind: 'doubleScience' },
    };
    expect(G.track?.activeModifiers ?? []).toEqual([]);
    expect(G._modifiers ?? []).toEqual([]);
    resolveTrackCard(G, detRandom(), mod);
    expect(G.track?.activeModifiers).toBeDefined();
    expect(G.track!.activeModifiers!.length).toBe(1);
    expect(G.track!.activeModifiers![0]!.id).toBe('mod-1');
    // The effect lands on _modifiers (the same queue event-card modifier
    // effects use) so any role move gating on `hasModifierActive` /
    // `consumeModifier` reads track- and event-sourced modifiers
    // uniformly. (V1 ships the helpers but doesn't yet wire any
    // role-move consumer; this assertion pins the queue plumbing so a
    // future consumer can be added without engine changes.)
    expect(G._modifiers).toBeDefined();
    expect(G._modifiers!.length).toBe(1);
    expect(G._modifiers![0]!.kind).toBe('doubleScience');
  });

  it('boss card dispatches through resolveBoss (does not throw, flips bossResolved)', () => {
    // 2.7 — boss is no longer a stub. With all thresholds at 0 and an
    // empty attackPattern, resolveBoss takes the trivial-defeat path:
    // every threshold counts as met, attacks clamps to 0, and only the
    // win flag fires. Tests for the rich attack-pattern math live in
    // tests/game/track/boss.spec.ts.
    const G = seedFreshGame(2);
    expect(G.bossResolved).toBe(false);
    expect(() =>
      resolveTrackCard(G, detRandom(), {
        kind: 'boss',
        id: 'b-1',
        name: 'Last',
        phase: 10,
        description: '',
        baseAttacks: 4,
        thresholds: { science: 0, economy: 0, military: 0 },
        attackPattern: [],
      }),
    ).not.toThrow();
    expect(G.bossResolved).toBe(true);
  });
});

describe('resolveTrackCard — threat resolution', () => {
  it('one Brute (atk=2) on Mill kills a strength-2 threat outright; reward goes to bank', () => {
    const G = buildG([
      unit({
        id: 'u1',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
    ]);
    const beforeWood = G.bank.wood;
    resolveTrackCard(
      G,
      detRandom(),
      threat({
        direction: 'N',
        offset: 0,
        strength: 2,
        reward: { wood: 1 },
      }),
    );
    // Mill HP unchanged.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);
    // Brute survives; threat killed → no repel HP cost.
    expect(G.defense!.inPlay).toHaveLength(1);
    expect(G.defense!.inPlay[0]!.hp).toBe(2);
    // Reward credited.
    expect(G.bank.wood).toBe(beforeWood + 1);
  });

  it('one Scout (atk=1) on Mill chips threat from 3 → 2; building takes 2 damage; Scout repels and survives at hp 0 (dies)', () => {
    const G = buildG([
      unit({
        id: 'u1',
        defID: 'Scout',
        cellKey: cellKey(0, 1),
        hp: 1,
        placementOrder: 0,
      }),
    ]);
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 3 }),
    );
    // Scout fired (atk=1), threat HP went 3 → 2. Threat survives.
    // Scout absorbs 1 HP repel cost → hp 0 → killed.
    expect(G.defense!.inPlay).toHaveLength(0);
    // Mill takes 2 damage (the leftover): hp was 2 maxHp 2, clamps at 1.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
  });

  it('two units stacked on the impact tile: bottom (older placement) absorbs first', () => {
    // Two Brutes (atk 2, hp 2) on the impact tile. Threat strength 8.
    // Fire phase: Brute1 fires → threat 8→6; Brute2 fires → threat 6→4.
    // Threat survives; both Brutes lose 1 HP repel (hp 2→1 each).
    // Stack absorption: leftover 4 damage hits the tile's stack in
    // placement order — Brute1 (p 0, hp 1) absorbs 1 → dies; remaining
    // 3 → Brute2 (p 1, hp 1) absorbs 1 → dies; remaining 2 → Mill hp
    // 2→0 clamp 1.
    //
    // The point is: bottom-placed (0) dies before top-placed (1).
    const G = buildG([
      unit({
        id: 'u1',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
      unit({
        id: 'u2',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 1,
      }),
    ]);
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 8 }),
    );

    // Both Brutes should be dead; Mill at 1 hp (clamped).
    expect(G.defense!.inPlay).toHaveLength(0);
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
  });

  it('stack consumption order: first-placed dies before later-placed when overflow kills only the bottom of the stack', () => {
    // Two Brutes (atk 2, hp 2) stacked on the impact tile. We craft a
    // threat strength such that:
    //   - both Brutes fire (range 1, both in fire slice → cover (0,1)
    //     and the entry cell (0, 2)),
    //   - threat survives the volley with leftover damage exactly
    //     equal to the bottom unit's HP after repel — so only the
    //     bottom unit dies and the top survives.
    // Threat strength 7. Brute1 fires: 7→5. Brute2 fires: 5→3. Threat
    // alive. Both Brutes lose 1 HP repel: 2→1 each. Leftover 3 hits
    // the stack: Brute1 (p 0, hp 1) absorbs 1 → dies; remaining 2 →
    // Brute2 (p 1, hp 1) absorbs 1 → dies; remaining 1 → Mill 2→1.
    // Hmm — both die. To verify *placement order specifically*, give
    // Brute2 an extra HP via direct construction:
    const G = buildG([
      unit({
        id: 'b1',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
      unit({
        id: 'b2',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 4, // synthetic — Phase 2.6 'reinforce' could bump this
        placementOrder: 1,
      }),
    ]);
    // Threat strength 7. Both Brutes fire: 7-2-2 = 3. Repel: b1 2→1,
    // b2 4→3. Stack: b1 absorbs 1 → 0 dies; remaining 2 → b2 absorbs
    // 2 → hp 1 (alive); remaining 0 → Mill stays at 2.
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 7 }),
    );
    // First-placed Brute (b1) died; second-placed (b2) survived.
    const remaining = G.defense!.inPlay.map((u) => u.id);
    expect(remaining).toContain('b2');
    expect(remaining).not.toContain('b1');
    // Building unaffected.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);
  });

  it('threat reaches center: pool burn drains non-chief stash deterministically with detRandom', () => {
    const G = buildG([]);
    // Seed stash on the non-chief seat. seedFreshGame(2) gives seats
    // 0 and 1; chief is seat 0, the only non-chief seat is '1'.
    const seats = Object.keys(G.mats);
    const nonChief = seats[0]!; // seedFreshGame(2): only one mat (non-chief)
    G.mats[nonChief]!.stash.gold = 5;
    // Threat strength 3, no buildings on path → reaches center.
    G.domestic!.grid = { [CENTER_CELL_KEY]: center };
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 3 }),
    );
    expect(G.mats[nonChief]!.stash.gold).toBe(2);
    // Bank log records the burn.
    const log = G.bankLog ?? [];
    const burnEntries = log.filter((e) => e.source === 'centerBurn');
    expect(burnEntries.length).toBe(1);
    expect(burnEntries[0]!.delta.gold).toBe(-3);
  });

  it('first-strike unit fires before non-first-strike (Knife Fighter atk=3 vs Brute atk=2)', () => {
    // Threat strength 3. With Knife Fighter (firstStrike=true, atk=3)
    // firing first, the threat dies after one swing — Brute never
    // fires, so Brute keeps full HP. Without first-strike, Brute would
    // have fired first and only chipped 2, then Knife Fighter kills.
    // Either way the threat dies, but the *Brute's* HP tells us the
    // order: with first-strike Brute is at 2 (didn't fire, no repel),
    // without first-strike both fired and Brute is at 1.
    const G = buildG([
      unit({
        id: 'brute',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
      unit({
        id: 'knife',
        defID: 'Knife Fighter',
        cellKey: cellKey(0, 1),
        hp: 1,
        placementOrder: 1,
      }),
    ]);
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 3 }),
    );
    // Knife Fighter killed the threat in one swing (atk=3, hp=3).
    // Brute never fired → Brute's hp untouched.
    const brute = G.defense!.inPlay.find((u) => u.id === 'brute');
    expect(brute).toBeDefined();
    expect(brute!.hp).toBe(2);
  });

  it('placement bonus applies: Sapper on Forge gets +1 strength', () => {
    // Sapper printed atk=4 + Forge bonus +1 = 5. Threat strength 5
    // dies in one fire. Without the bonus, threat survives at 1.
    const G = seedFreshGame(2);
    G.domestic = {
      hand: [],
      grid: {
        [CENTER_CELL_KEY]: center,
        [cellKey(0, 1)]: placedBuilding('Forge', 3, 3),
      },
    };
    G.defense = {
      hand: [],
      inPlay: [
        unit({
          id: 'sapper',
          defID: 'Sapper',
          cellKey: cellKey(0, 1),
          hp: 3,
          placementOrder: 0,
        }),
      ],
    };
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 5 }),
    );
    // Threat killed → building unchanged, Sapper unchanged.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(3);
    expect(G.defense!.inPlay).toHaveLength(1);
    expect(G.defense!.inPlay[0]!.hp).toBe(3);
  });

  it('placement bonus extending range: Watchman on Tower covers an extra cell', () => {
    // Watchman's printed range is 1; on a Tower it gets +1 → 2.
    // Place Watchman on Tower at (0,1); place a Mill at (0,2). Threat
    // from N at offset 0 walks (0, 3) → (0, 2) → (0, 1) → center.
    // The first impact tile is (0, 2) (the Mill). Watchman at (0, 1)
    // with range 2 can reach the cell (0, 3) which is the entry —
    // Chebyshev distance is 2. Without the bonus (range 1), it can't
    // reach (0, 3) — distance 2 > range 1. With the bonus (range 2),
    // it does. We test by giving the Watchman atk=10 so its fire is
    // detectable as "threat dies".
    const G = seedFreshGame(2);
    G.domestic = {
      hand: [],
      grid: {
        [CENTER_CELL_KEY]: center,
        [cellKey(0, 1)]: placedBuilding('Tower', 4, 4),
        [cellKey(0, 2)]: placedBuilding('Mill', 2, 2),
      },
    };
    G.defense = {
      hand: [],
      inPlay: [
        unit({
          id: 'watch',
          defID: 'Watchman',
          cellKey: cellKey(0, 1),
          hp: 3,
          placementOrder: 0,
        }),
      ],
    };
    // Strength 1 → one Watchman fire (atk=1) kills it; Watchman fires
    // because it's in range of the path (with the +1 from Tower).
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 1 }),
    );
    expect(G.domestic!.grid[cellKey(0, 2)]!.hp).toBe(2);
    expect(G.defense!.inPlay[0]!.hp).toBe(3); // killed → no repel
  });

  it('matchup keyword "+N vs <tag>" adds to strength when threat carries the tag', () => {
    // Designated Marksman has note "+2 vs ranged". Threat with
    // modifiers ["ranged"] should get +2 strength.
    // Marksman atk=6 + 2 = 8. Threat strength 8 dies in one swing.
    // Without the tag, atk=6 only → threat survives at 2 → marksman
    // repels (hp 4→3); leftover 2 absorbs into marksman (impact tile
    // stack) → marksman hp 3→1; remaining 0 → Mill at 2. Mill HP is
    // unchanged in BOTH cases, so we verify the bonus by inspecting
    // the unit's HP instead.
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
      inPlay: [
        unit({
          id: 'dm',
          defID: 'Designated Marksman',
          cellKey: cellKey(0, 1),
          hp: 4,
          placementOrder: 0,
        }),
      ],
    };
    // Without tag: marksman fires, threat survives, marksman takes
    // repel + stack damage. Verify marksman is at hp 1.
    const noTag = JSON.parse(JSON.stringify(G)) as SettlementState;
    resolveTrackCard(
      noTag,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 8 }),
    );
    expect(noTag.defense!.inPlay[0]!.hp).toBe(1);

    // With tag: marksman atk 6+2=8 → threat dies in one swing → no
    // repel cost, marksman keeps full HP.
    resolveTrackCard(
      G,
      detRandom(),
      threat({
        direction: 'N',
        offset: 0,
        strength: 8,
        modifiers: ['ranged'],
      }),
    );
    expect(G.defense!.inPlay[0]!.hp).toBe(4);
  });

  it('drill token consumes on fire and adds +1 strength', () => {
    const G = buildG([
      unit({
        id: 'u',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
        drillToken: true,
      }),
    ]);
    // Brute atk 2 + drill 1 = 3. Threat strength 3 dies.
    resolveTrackCard(
      G,
      detRandom(),
      threat({ direction: 'N', offset: 0, strength: 3 }),
    );
    // Drill consumed (token cleared).
    expect(G.defense!.inPlay[0]!.drillToken).toBeFalsy();
    // Mill unchanged.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);
  });

  it('determinism: two runs with the same seed produce the same final state', () => {
    const buildAndRun = (): SettlementState => {
      const G = buildG([]);
      // Seed pool on the non-chief seat.
      const nonChief = Object.keys(G.mats)[0]!;
      G.mats[nonChief]!.stash.wood = 3;
      G.mats[nonChief]!.stash.stone = 2;
      G.domestic!.grid = { [CENTER_CELL_KEY]: center };
      // Sequence 5 distinct threats.
      for (let i = 0; i < 5; i += 1) {
        resolveTrackCard(
          G,
          detRandom(),
          threat({ id: `t${i}`, direction: 'N', offset: 0, strength: 1 }),
        );
      }
      return G;
    };
    const a = buildAndRun();
    const b = buildAndRun();
    const aSeat = Object.keys(a.mats)[0]!;
    const bSeat = Object.keys(b.mats)[0]!;
    expect(a.mats[aSeat]!.stash).toEqual(b.mats[bSeat]!.stash);
    expect(a.bankLog).toEqual(b.bankLog);
  });
});

describe('centerBurn', () => {
  it('drains the requested amount or the available pool, whichever is smaller', () => {
    const G = seedFreshGame(2);
    const seat = Object.keys(G.mats)[0]!;
    G.mats[seat]!.stash.gold = 2;
    const burned = centerBurn(G, detRandom(), 5);
    // Pool only had 2 → that's all that burned.
    expect(G.mats[seat]!.stash.gold).toBe(0);
    expect(burned.gold).toBe(2);
    // Bank log gets one summary entry.
    const log = (G.bankLog ?? []).filter((e) => e.source === 'centerBurn');
    expect(log).toHaveLength(1);
    expect(log[0]!.delta.gold).toBe(-2);
  });

  it('empty pool: no log entry, returns empty bag', () => {
    const G = seedFreshGame(2);
    const before = (G.bankLog ?? []).length;
    const burned = centerBurn(G, detRandom(), 4);
    expect(burned).toEqual({});
    expect((G.bankLog ?? []).length).toBe(before);
  });
});
