// End-condition tests for the Settlement game.
//
// `endIf` is a pure 2-arg function over `(G, ctx)`, so most tests drive it
// directly with a hand-rolled `SettlementState` shell. The `setupData.turnCap`
// case calls `setup` directly (rather than booting a client) because bgio's
// 0.50 `Client.start()` doesn't surface a `setupData` knob — `Server` does,
// but spinning a server up here would just add ceremony around the same
// path.
//
// 1.5 (D25): `settlementsJoined >= 10` retired. The win path now keys off
// `G.bossResolved`, which Phase 2.7 will flip to `true` when the village
// resolves the boss card on the global event track. Until 2.7 lands, the
// only end-of-game outcome is `timeUp` once `G.round` hits the cap.

import { describe, expect, it } from 'vitest';
import {
  endIf,
  onEnd,
  computeRunScore,
  TURN_CAP_DEFAULT,
} from '../src/game/endConditions.ts';
import type { SettlementState } from '../src/game/types.ts';
import { setup } from '../src/game/setup.ts';
import { EMPTY_BAG } from '../src/game/resources/types.ts';
import { resolveBoss } from '../src/game/track/boss.ts';
import type { BossCard } from '../src/data/schema.ts';
import type { RandomAPI } from '../src/game/random.ts';
import { seedFreshGame } from './helpers/factories.ts';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../src/game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../src/game/roles/domestic/types.ts';

// Smallest legal SettlementState shell — `endIf` only reads `round`,
// `bossResolved`, and `turnCap`, but the full shape is required by the
// type signature. Keeping the rest minimal.
const stubG = (
  partial: Partial<SettlementState> = {},
): SettlementState => ({
  bank: { ...EMPTY_BAG },
  centerMat: {},
  roleAssignments: { '0': ['chief'], '1': ['science'] },
  round: 0,
  bossResolved: false,
  hands: {},
  mats: {},
  ...partial,
});

describe('endIf', () => {
  it('returns undefined while no end condition has fired', () => {
    const G = stubG({ round: 50 });
    expect(endIf(G, undefined)).toBeUndefined();
  });

  it('returns a win when bossResolved is true', () => {
    const G = stubG({ round: 25, bossResolved: true });
    expect(endIf(G, undefined)).toEqual({
      kind: 'win',
      turns: 25,
    });
  });

  it('returns timeUp at the default 80-round cap', () => {
    const G = stubG({ round: 80 });
    expect(endIf(G, undefined)).toEqual({
      kind: 'timeUp',
      turns: 80,
    });
  });

  it('win takes precedence when both fire on the same round', () => {
    const G = stubG({ round: 80, bossResolved: true });
    expect(endIf(G, undefined)).toEqual({
      kind: 'win',
      turns: 80,
    });
  });

  it('setupData.turnCap = 20 shortens the cap; firing at round 20', () => {
    // Drive `setup` directly with a minimal ctx — the headless `Client` path
    // doesn't expose `setupData` in this version of bgio, so we exercise the
    // wiring at the source. The default fallback random (identity shuffle)
    // is used implicitly.
    const ctx = { numPlayers: 2 } as unknown as Parameters<typeof setup>[0]['ctx'];
    const G = setup({ ctx }, { turnCap: 20 });

    expect(G.turnCap).toBe(20);
    expect(TURN_CAP_DEFAULT).toBe(80);
    // bossResolved must default to false at setup so endIf can read the
    // field without a guard.
    expect(G.bossResolved).toBe(false);

    // Below the shortened cap → no end.
    G.round = 19;
    expect(endIf(G, undefined)).toBeUndefined();

    // At the shortened cap → timeUp.
    G.round = 20;
    expect(endIf(G, undefined)).toEqual({
      kind: 'timeUp',
      turns: 20,
    });
  });

  it('after resolveBoss (2.7) flips bossResolved, endIf returns a win', () => {
    // The full integration: a boss card flips → resolveBoss runs → endIf
    // reports the village won. Uses a trivially-defeatable boss (all
    // thresholds met by default seed values, baseAttacks = 1) so the
    // test focuses on the win-flag flow rather than the attack math.
    const G = seedFreshGame(2);
    G.round = 30;
    G.bank.gold = 100;
    G.science!.completed = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const boss: BossCard = {
      kind: 'boss',
      id: 'b-test',
      name: 'Test Boss',
      phase: 10,
      description: '',
      baseAttacks: 1,
      thresholds: { science: 1, economy: 1 },
      attackPattern: [{ direction: 'N', offset: 0, strength: 1 }],
    };
    const r: RandomAPI = {
      shuffle: <T>(a: ReadonlyArray<T>): T[] => [...a],
      pickOne: <T>(a: ReadonlyArray<T>): T => a[0]!,
      rangeInt: (lo: number) => lo,
    };
    expect(endIf(G, undefined)).toBeUndefined();
    resolveBoss(G, r, boss);
    expect(G.bossResolved).toBe(true);
    expect(G.turnsAtWin).toBe(30);
    expect(endIf(G, undefined)).toEqual({ kind: 'win', turns: 30 });
  });
});

describe('onEnd (2.7) — score recording', () => {
  const center: DomesticBuilding = {
    defID: 'Center',
    upgrades: 0,
    worker: null,
    hp: 99,
    maxHp: 99,
    isCenter: true,
  };

  it('writes a win score onto G._score with rounds / buildings / units snapshot', () => {
    const G = seedFreshGame(2);
    G.round = 22;
    G.bossResolved = true;
    G.turnsAtWin = 22;
    G.domestic = {
      hand: [],
      grid: {
        [CENTER_CELL_KEY]: center,
        [cellKey(0, 1)]: {
          defID: 'Mill',
          upgrades: 0,
          worker: null,
          hp: 4,
          maxHp: 4,
        },
        [cellKey(1, 0)]: {
          defID: 'Forge',
          upgrades: 0,
          worker: null,
          hp: 2,
          maxHp: 4,
        },
      },
    };
    G.defense = {
      hand: [],
      inPlay: [
        {
          id: 'u1',
          defID: 'Brute',
          cellKey: cellKey(0, 1),
          hp: 2,
          placementOrder: 0,
        },
      ],
    };
    onEnd(G);
    expect(G._score).toBeDefined();
    expect(G._score!.outcome).toBe('win');
    expect(G._score!.rounds).toBe(22);
    expect(G._score!.buildingsAtEnd).toBe(2); // Mill + Forge, center excluded
    // Mill at 100% (4/4), Forge at 50% (2/4) → average 75.
    expect(G._score!.hpRetainedPct).toBe(75);
    expect(G._score!.unitsAlive).toBe(1);
  });

  it('writes a timeUp score when the cap is hit without a win', () => {
    const G = seedFreshGame(2);
    G.round = TURN_CAP_DEFAULT;
    G.bossResolved = false;
    onEnd(G);
    expect(G._score).toBeDefined();
    expect(G._score!.outcome).toBe('timeUp');
    expect(G._score!.rounds).toBe(TURN_CAP_DEFAULT);
  });

  it('computeRunScore: hpRetainedPct is 0 when no non-center buildings exist', () => {
    const G = seedFreshGame(2);
    G.domestic = {
      hand: [],
      grid: { [CENTER_CELL_KEY]: center },
    };
    const score = computeRunScore(G, 'timeUp');
    expect(score.buildingsAtEnd).toBe(0);
    expect(score.hpRetainedPct).toBe(0);
    expect(score.unitsAlive).toBe(0);
  });
});
