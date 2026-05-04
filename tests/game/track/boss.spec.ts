// Defense redesign 2.7 — boss resolver tests.
//
// Pure unit tests over `resolveBoss(G, random, card)` exercised against
// hand-rolled `SettlementState` fixtures. We don't drive a full bgio
// client here — the resolver is a pure mutation, and threading the
// scenario "the boss has flipped, with these thresholds and this many
// units" through `chiefFlipTrack` would just add ceremony around the
// same path. The full-track bot run lives in `tests/fuzz/`.

import { describe, expect, it } from 'vitest';
import {
  resolveBoss,
  countCompletedScience,
  sumUnitStrength,
  countMetThresholds,
} from '../../../src/game/track/boss.ts';
import { resolveTrackCard } from '../../../src/game/track/resolver.ts';
import type { BossCard, ThreatPattern } from '../../../src/data/schema.ts';
import type { RandomAPI } from '../../../src/game/random.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
import { seedFreshGame } from '../../helpers/factories.ts';
import { endIf } from '../../../src/game/endConditions.ts';

// Deterministic random — `pickOne` always picks index 0; `shuffle` is
// identity. Mirrors the stub in resolver.spec.ts so the boss tests share
// the same idiom.
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

const bossPattern = (
  ...overrides: ThreatPattern[]
): ThreatPattern[] =>
  overrides.length > 0
    ? overrides
    : [{ direction: 'N', offset: 0, strength: 4 }];

const buildBoss = (overrides: Partial<BossCard> = {}): BossCard => ({
  kind: 'boss',
  id: 'b-test',
  name: 'Test Boss',
  phase: 10,
  description: 'A test boss',
  baseAttacks: 4,
  thresholds: { science: 6, economy: 12, military: 8 },
  attackPattern: bossPattern(),
  ...overrides,
});

// Build a SettlementState with a center + a generic outpost building.
// The outpost absorbs threat damage so we can read attacks reliably from
// the building's HP delta without paths terminating at center every time.
const buildG = (units: UnitInstance[] = []): SettlementState => {
  const G = seedFreshGame(2);
  G.domestic = {
    hand: [],
    grid: {
      [CENTER_CELL_KEY]: center,
      [cellKey(0, 1)]: placedBuilding('Mill', 4, 4),
    },
  };
  G.defense = { hand: [], inPlay: units };
  return G;
};

describe('countCompletedScience', () => {
  it('returns the length of G.science.completed', () => {
    const G = seedFreshGame(2);
    expect(countCompletedScience(G)).toBe(0);
    G.science!.completed.push('sci-1', 'sci-2', 'sci-3');
    expect(countCompletedScience(G)).toBe(3);
  });

  it('returns 0 when G.science is absent', () => {
    const G = seedFreshGame(2);
    G.science = undefined;
    expect(countCompletedScience(G)).toBe(0);
  });
});

describe('sumUnitStrength', () => {
  it("sums each placed unit's printed UnitDef.attack", () => {
    // Brute is a baseline starter unit (atk 2). Use two of them so we
    // can observe additivity without leaning on a specific def's value.
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
        hp: 2,
        placementOrder: 1,
      }),
    ]);
    expect(sumUnitStrength(G)).toBe(4);
  });

  it('treats unknown defIDs as zero contribution', () => {
    const G = buildG([
      unit({
        id: 'fake',
        defID: 'NotARealUnit',
        cellKey: cellKey(0, 1),
        hp: 1,
        placementOrder: 0,
      }),
    ]);
    expect(sumUnitStrength(G)).toBe(0);
  });
});

describe('countMetThresholds', () => {
  it('returns 0 when no threshold is met', () => {
    const G = buildG([]);
    G.bank.gold = 0;
    expect(
      countMetThresholds(
        G,
        buildBoss({ thresholds: { science: 1, economy: 1, military: 1 } }),
      ),
    ).toBe(0);
  });

  it('returns 3 when all thresholds are met', () => {
    const G = buildG([
      unit({
        id: 'b1',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
    ]);
    G.bank.gold = 10;
    G.science!.completed = ['s1', 's2', 's3'];
    expect(
      countMetThresholds(
        G,
        buildBoss({ thresholds: { science: 2, economy: 5, military: 1 } }),
      ),
    ).toBe(3);
  });
});

describe('resolveBoss — attacks-met math', () => {
  it('all three thresholds met: attacks = max(0, baseAttacks - 3)', () => {
    const G = buildG([
      unit({
        id: 'b',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
    ]);
    G.bank.gold = 99;
    G.science!.completed = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const initialMillHp = G.domestic!.grid[cellKey(0, 1)]!.hp;
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 4,
        thresholds: { science: 6, economy: 12, military: 1 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 2 }],
      }),
    );
    // 4 - 3 met = 1 attack. Brute on Mill (atk 2) one-shots strength-2 →
    // Mill HP unchanged.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(initialMillHp);
    expect(G.bossResolved).toBe(true);
  });

  it('zero thresholds met: attacks = baseAttacks', () => {
    // Force every threshold to be unmet: empty bank, no science, no units.
    const G = buildG([]);
    G.bank.gold = 0;
    G.science!.completed = [];
    // Each attack walks N at offset 0; first impact is the Mill at (0,1).
    // baseAttacks = 4, thresholds met = 0 → 4 attacks of strength 1 each
    // chip the Mill from 4 → 1 (clamped, can't fall below 1).
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 4,
        thresholds: { science: 1, economy: 1, military: 1 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 1 }],
      }),
    );
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
    expect(G.bossResolved).toBe(true);
  });

  it('attacks clamp at 0 when baseAttacks <= thresholds met', () => {
    // baseAttacks 2 with all 3 thresholds met → max(0, 2 - 3) = 0 attacks.
    // Mill HP stays at full and the boss flag still flips.
    const G = buildG([
      unit({
        id: 'b',
        defID: 'Brute',
        cellKey: cellKey(0, 1),
        hp: 2,
        placementOrder: 0,
      }),
    ]);
    G.bank.gold = 99;
    G.science!.completed = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const initialHp = G.domestic!.grid[cellKey(0, 1)]!.hp;
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 2,
        thresholds: { science: 6, economy: 12, military: 1 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 5 }],
      }),
    );
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(initialHp);
    expect(G.bossResolved).toBe(true);
  });
});

describe('resolveBoss — pattern cycling', () => {
  it('attack pattern cycles when attacks > pattern length', () => {
    // Pattern of length 1, baseAttacks 3, no thresholds met → 3 attacks
    // all of strength 1 against the Mill (4 hp). Mill chipped to 1.
    const G = buildG([]);
    G.bank.gold = 0;
    G.science!.completed = [];
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 3,
        thresholds: { science: 1, economy: 1, military: 1 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 1 }],
      }),
    );
    // 3 attacks of 1 damage each: Mill hp 4 → 3 → 2 → 1 (clamped at 1
    // floor only matters once it hits 1; here exactly 1).
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
    expect(G.bossResolved).toBe(true);
  });
});

describe('resolveBoss — bossResolved flag', () => {
  it('flips G.bossResolved to true after resolving', () => {
    const G = buildG([]);
    expect(G.bossResolved).toBe(false);
    resolveBoss(G, detRandom(), buildBoss({ baseAttacks: 1 }));
    expect(G.bossResolved).toBe(true);
  });

  it('snapshots the round at which the boss resolved into G.turnsAtWin', () => {
    const G = buildG([]);
    G.round = 27;
    resolveBoss(G, detRandom(), buildBoss({ baseAttacks: 1 }));
    expect(G.turnsAtWin).toBe(27);
  });

  it('village wins even when boss attacks raze the only building', () => {
    // Single Mill at (0, 1), HP 1 (already on the floor — building can't
    // be destroyed, but we test that the win flag flips regardless).
    const G = buildG([]);
    G.domestic!.grid[cellKey(0, 1)]!.hp = 1;
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 1,
        thresholds: { science: 99, economy: 99, military: 99 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 99 }],
      }),
    );
    // Building was unscathable below 1; verify the win flag still fired
    // and that endIf reports a win.
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
    expect(G.bossResolved).toBe(true);
    expect(endIf(G, undefined)).toEqual({ kind: 'win', turns: G.round });
  });
});

describe('resolveBoss — edge cases', () => {
  it('village with 0 buildings (only center): attacks land as center burns', () => {
    // Empty grid except center. Threats with no buildings on path go
    // straight to center; each attack's strength becomes a center-pool
    // burn. Seed the non-chief seat with a stash so we can read the burn.
    const G = seedFreshGame(2);
    G.domestic = { hand: [], grid: { [CENTER_CELL_KEY]: center } };
    G.defense = { hand: [], inPlay: [] };
    const seats = Object.keys(G.mats);
    const nonChief = seats[0]!;
    G.mats[nonChief]!.stash.gold = 6;
    resolveBoss(
      G,
      detRandom(),
      buildBoss({
        baseAttacks: 2,
        thresholds: { science: 99, economy: 99, military: 99 },
        attackPattern: [{ direction: 'N', offset: 0, strength: 2 }],
      }),
    );
    // Two attacks of strength 2 → 4 gold burned (det random on a single
    // seat / single resource type).
    expect(G.mats[nonChief]!.stash.gold).toBe(2);
    expect(G.bossResolved).toBe(true);
  });

  it('determinism: identical seed produces identical boss outcome', () => {
    const buildAndRun = (): SettlementState => {
      const G = seedFreshGame(2);
      G.domestic = { hand: [], grid: { [CENTER_CELL_KEY]: center } };
      G.defense = { hand: [], inPlay: [] };
      const seats = Object.keys(G.mats);
      const nonChief = seats[0]!;
      G.mats[nonChief]!.stash.gold = 5;
      G.mats[nonChief]!.stash.wood = 5;
      resolveBoss(
        G,
        detRandom(),
        buildBoss({
          baseAttacks: 3,
          thresholds: { science: 99, economy: 99, military: 99 },
          attackPattern: [
            { direction: 'N', offset: 0, strength: 1 },
            { direction: 'E', offset: 0, strength: 1 },
            { direction: 'S', offset: 0, strength: 1 },
          ],
        }),
      );
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

describe('resolveTrackCard — boss dispatch (regression)', () => {
  it('routes a boss card through resolveBoss (no-throw, flips flag)', () => {
    const G = buildG([]);
    expect(() =>
      resolveTrackCard(
        G,
        detRandom(),
        buildBoss({
          baseAttacks: 1,
          thresholds: { science: 99, economy: 99, military: 99 },
          attackPattern: [{ direction: 'N', offset: 0, strength: 1 }],
        }),
      ),
    ).not.toThrow();
    expect(G.bossResolved).toBe(true);
  });
});
