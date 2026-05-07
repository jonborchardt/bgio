// Issue 030 — focused coverage for `appendBankLog` + `economyHigh`
// + `computeBankView`. These functions live behind every bank
// mutation in the engine but only had indirect coverage via
// downstream tests.

import { describe, expect, it } from 'vitest';
import {
  appendBankLog,
  computeBankView,
  negateBag,
} from '../../src/game/resources/bankLog.ts';
import type { SettlementState } from '../../src/game/types.ts';

const stateWithBank = (gold: number, round = 0): SettlementState => ({
  bank: {
    gold,
    wood: 0,
    stone: 0,
    steel: 0,
    horse: 0,
    food: 0,
    production: 0,
    science: 0,
    happiness: 0,
    worker: 0,
  },
  hands: {},
  mats: {},
  roleAssignments: {},
  round,
  bossResolved: false,
  // Test fixtures historically synthesize a partial state — cast
  // through `as unknown as` so the structural shape is loose enough.
} as unknown as SettlementState);

describe('appendBankLog (issue 030)', () => {
  it('records a signed delta with the current round number', () => {
    const G = stateWithBank(5, 3);
    appendBankLog(G, 'distribute', { gold: -1 });
    expect(G.bankLog).toEqual([
      { round: 3, source: 'distribute', delta: { gold: -1 } },
    ]);
  });

  it('skips empty deltas (every entry zero)', () => {
    const G = stateWithBank(5);
    appendBankLog(G, 'sweep', {});
    appendBankLog(G, 'sweep', { gold: 0 });
    expect(G.bankLog).toBeUndefined();
  });

  it('keeps an optional detail string when provided', () => {
    const G = stateWithBank(5, 1);
    appendBankLog(G, 'eventCard', { gold: 2 }, 'storm passes');
    expect(G.bankLog?.[0]?.detail).toBe('storm passes');
  });

  it('refreshes economyHigh on the running max bank gold', () => {
    const G = stateWithBank(3);
    appendBankLog(G, 'stipend', { gold: 3 });
    expect(G.economyHigh).toBe(3);
    G.bank.gold = 7;
    appendBankLog(G, 'stipend', { gold: 4 });
    expect(G.economyHigh).toBe(7);
    // Spending below the high-water mark must NOT lower it.
    G.bank.gold = 2;
    appendBankLog(G, 'distribute', { gold: -5 });
    expect(G.economyHigh).toBe(7);
  });
});

describe('negateBag (issue 030)', () => {
  it('negates non-zero entries and drops zeros', () => {
    expect(negateBag({ gold: 3, wood: 0, stone: -2 })).toEqual({
      gold: -3,
      stone: 2,
    });
  });
});

describe('computeBankView (issue 030)', () => {
  it('sums positive deltas for the current round into `income`', () => {
    const G = stateWithBank(10, 2);
    appendBankLog(G, 'stipend', { gold: 3 });
    appendBankLog(G, 'eventCard', { gold: 2 });
    appendBankLog(G, 'distribute', { gold: -1 });
    const view = computeBankView(G);
    expect(view.income.gold).toBe(5); // 3 + 2; the -1 doesn't count
  });

  it('clamps stash at zero per resource', () => {
    const G = stateWithBank(0, 1);
    // A round delta larger than the current bank would push stash
    // negative — `computeBankView` clamps it at zero so the chief
    // tooltip never renders a negative stash.
    appendBankLog(G, 'eventCard', { gold: 5 });
    G.bank.gold = 0;
    const view = computeBankView(G);
    expect(view.stash.gold).toBe(0);
  });

  it('only considers entries from the current round', () => {
    const G = stateWithBank(8, 2);
    G.bankLog = [
      { round: 1, source: 'eventCard', delta: { gold: 4 } },
      { round: 2, source: 'stipend', delta: { gold: 3 } },
    ];
    const view = computeBankView(G);
    expect(view.income.gold).toBe(3); // round 1's 4 doesn't count
  });
});
