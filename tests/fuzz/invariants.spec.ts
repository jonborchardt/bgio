// Unit tests for the fuzz-harness invariants (11.1).
//
// The fuzz suite itself *is* its own test (it just needs to run cleanly),
// but each individual invariant gets a tiny reproducer here so a regression
// surfaces with a clean signal — not lost in the fuzz noise.

import { describe, expect, it } from 'vitest';
import {
  assertNoNegativeResources,
  assertTurnsBounded,
} from './invariants.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { EMPTY_BAG } from '../../src/game/resources/types.ts';

const cleanState = (
  partial: Partial<SettlementState> = {},
): SettlementState => ({
  bank: { ...EMPTY_BAG },
  centerMat: { tradeRequest: null },
  roleAssignments: { '0': ['chief'], '1': ['science'] },
  round: 0,
  settlementsJoined: 0,
  hands: {},
  mats: {},
  ...partial,
});

describe('assertNoNegativeResources', () => {
  it('passes on a clean state', () => {
    const G = cleanState();
    expect(() => assertNoNegativeResources(G)).not.toThrow();
  });

  it('throws when bank.gold is -1', () => {
    const G = cleanState({ bank: { ...EMPTY_BAG, gold: -1 } });
    expect(() => assertNoNegativeResources(G)).toThrow(/bank\.gold/);
  });
});

describe('assertTurnsBounded', () => {
  it('throws when ctx.turn exceeds the max', () => {
    const state = { ctx: { turn: 11 } } as unknown as Parameters<
      typeof assertTurnsBounded
    >[0];
    expect(() => assertTurnsBounded(state, 10)).toThrow(/ctx\.turn = 11/);
  });

  it('does not throw at exactly the max', () => {
    const state = { ctx: { turn: 10 } } as unknown as Parameters<
      typeof assertTurnsBounded
    >[0];
    expect(() => assertTurnsBounded(state, 10)).not.toThrow();
  });
});
