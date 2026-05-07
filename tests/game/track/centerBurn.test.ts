// Issue 030 — focused coverage for `centerBurn`. The resolver-side
// integration tests already exercise it in passing; this file pins
// the burn primitive's contract directly: bounded burn amount,
// per-seat / per-resource random draw, audit log entry shape, and
// the empty-pool no-op.

import { describe, expect, it } from 'vitest';
import { centerBurn } from '../../../src/game/track/centerBurn.ts';
import { initialBank } from '../../../src/game/resources/bank.ts';
import { assignRoles, seatOfRole } from '../../../src/game/roles.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { RandomAPI } from '../../../src/game/random.ts';

const buildG = (): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  // Seed a known stash on every non-chief seat so the burn has tokens
  // to consume.
  for (const seat of Object.keys(mats)) {
    mats[seat]!.stash = {
      gold: 0,
      wood: 5,
      stone: 5,
      steel: 0,
      horse: 0,
      food: 5,
      production: 0,
      science: 0,
      happiness: 0,
      worker: 0,
    };
  }
  return {
    bank: initialBank(),
    roleAssignments,
    round: 3,
    bossResolved: false,
    mats,
    hands: {},
  } as unknown as SettlementState;
};

// Deterministic RNG that returns the first item — keeps the test
// reproducible without coupling to bgio's plugin internals.
const stubRandom = (): RandomAPI =>
  ({
    pickOne: <T>(arr: ReadonlyArray<T>): T => arr[0]!,
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
    D6: () => 1,
  }) as unknown as RandomAPI;

describe('centerBurn (issue 030)', () => {
  it('returns an empty bag for non-positive `requested`', () => {
    const G = buildG();
    expect(centerBurn(G, stubRandom(), 0)).toEqual({});
    expect(centerBurn(G, stubRandom(), -3)).toEqual({});
    expect(centerBurn(G, stubRandom(), Number.NaN)).toEqual({});
    // No log entries either.
    expect(G.bankLog ?? []).toEqual([]);
  });

  it('drains exactly `requested` tokens from the pool when supply allows', () => {
    const G = buildG();
    const burned = centerBurn(G, stubRandom(), 4);
    let total = 0;
    for (const v of Object.values(burned)) total += v ?? 0;
    expect(total).toBe(4);
  });

  it('clamps the burn at the pool total when `requested` exceeds supply', () => {
    const G = buildG();
    // Per-seat stash totals 15 (5 wood + 5 stone + 5 food); 3 non-chief
    // seats → pool of 45. Ask for more.
    const burned = centerBurn(G, stubRandom(), 999);
    let total = 0;
    for (const v of Object.values(burned)) total += v ?? 0;
    expect(total).toBe(45);
  });

  it('appends a single negative-delta `centerBurn` entry on G.bankLog', () => {
    const G = buildG();
    centerBurn(G, stubRandom(), 3, 'Cyclone');
    expect(G.bankLog?.length).toBe(1);
    const entry = G.bankLog![0]!;
    expect(entry.source).toBe('centerBurn');
    expect(entry.detail).toBe('Cyclone');
    // Issue 039 — centerBurn entries are flagged nonBankFlow.
    expect(entry.nonBankFlow).toBe(true);
    let signed = 0;
    for (const v of Object.values(entry.delta)) signed += v ?? 0;
    expect(signed).toBe(-3);
  });

  it('skips logging when nothing was burned (empty pool, audit-clean)', () => {
    const G = buildG();
    // Drain every seat's stash so the pool is empty.
    for (const seat of Object.keys(G.mats)) {
      const mat = G.mats[seat];
      if (!mat) continue;
      for (const r of Object.keys(mat.stash)) {
        (mat.stash as Record<string, number>)[r] = 0;
      }
    }
    const burned = centerBurn(G, stubRandom(), 5);
    expect(burned).toEqual({});
    expect(G.bankLog ?? []).toEqual([]);
  });

  it('only consumes from non-chief seats (chief mat is excluded)', () => {
    const G = buildG();
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
    expect(G.mats[chiefSeat]).toBeUndefined();
    centerBurn(G, stubRandom(), 5);
    // After the burn, the chief still has no mat (no surprise creation).
    expect(G.mats[chiefSeat]).toBeUndefined();
  });
});
