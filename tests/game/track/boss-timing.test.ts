// Issue 038 — round-counter timing invariant for boss resolution.
//
// `resolveBoss` snapshots `G.round` into `G.turnsAtWin` at the moment
// the village survives. `endOfRound.onBegin` increments `G.round`
// after the round-end hooks fire; bgio's `endIf` then evaluates
// before / after that increment depending on phase. The semantics
// we care about: `endIf` returning `kind: 'win'` should expose the
// round the boss was beaten on, not the round AFTER it.
//
// A future refactor that flips the order (e.g. moving `turnsAtWin`
// capture into a hook that runs after the increment) would silently
// off-by-one this test.

import { describe, expect, it } from 'vitest';
import { endIf } from '../../../src/game/endConditions.ts';
import { resolveBoss } from '../../../src/game/track/boss.ts';
import { initialBank } from '../../../src/game/resources/bank.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { BossCard } from '../../../src/data/schema.ts';
import type { RandomAPI } from '../../../src/game/random.ts';

const stubRandom = (): RandomAPI =>
  ({
    pickOne: <T>(arr: ReadonlyArray<T>): T => arr[0]!,
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
    D6: () => 1,
  }) as unknown as RandomAPI;

const baseG = (round: number): SettlementState =>
  ({
    bank: initialBank(),
    roleAssignments: assignRoles(2),
    round,
    bossResolved: false,
    mats: {},
    hands: {},
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [] },
    library: undefined,
    track: undefined,
  }) as unknown as SettlementState;

const noopBoss = (): BossCard =>
  ({
    kind: 'boss',
    id: 'boss:test',
    name: 'Test Boss',
    phase: 10,
    description: 'no attacks',
    thresholds: { science: 0, economy: 0 },
    baseAttacks: 0,
    attackPattern: [],
  }) as unknown as BossCard;

describe('boss timing — turnsAtWin captures the resolving round (issue 038)', () => {
  it('turnsAtWin equals G.round at the moment resolveBoss flips bossResolved', () => {
    const G = baseG(14);
    expect(G.bossResolved).toBe(false);
    expect(G.turnsAtWin).toBeUndefined();

    resolveBoss(G, stubRandom(), noopBoss());

    expect(G.bossResolved).toBe(true);
    expect(G.turnsAtWin).toBe(14);
  });

  it("endIf returns kind='win' with turns = turnsAtWin (not the post-increment round)", () => {
    const G = baseG(7);
    resolveBoss(G, stubRandom(), noopBoss());
    // Simulate `endOfRound.onBegin` ticking the round before `endIf`
    // gets a chance to evaluate the win — `turnsAtWin` must NOT shift.
    G.round = 8;
    const out = endIf(G, undefined);
    expect(out).toEqual({ kind: 'win', turns: 7 });
  });

  it('endIf falls back to G.round when turnsAtWin is somehow unset', () => {
    const G = baseG(11);
    G.bossResolved = true;
    // `turnsAtWin` was never set (a future bug or partial state) —
    // endIf must still return a win, falling through to G.round.
    expect(G.turnsAtWin).toBeUndefined();
    const out = endIf(G, undefined);
    expect(out).toEqual({ kind: 'win', turns: 11 });
  });
});
