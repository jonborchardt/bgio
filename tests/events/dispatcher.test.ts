// 08.2 — Event-effect dispatcher unit tests.
//
// These exercise `dispatch` directly against a hand-built SettlementState
// + a deterministic stub random. They are *not* end-to-end tests of the
// play*Event move shape — those live in tests/events/moves.test.ts.

import { describe, expect, it } from 'vitest';
import {
  dispatch,
  hasModifierActive,
  consumeModifier,
} from '../../src/game/events/dispatcher.ts';
import type { EventEffect } from '../../src/game/events/effects.ts';
import type { EventCardDef } from '../../src/game/events/state.ts';
import { fromBgio, type BgioRandomLike } from '../../src/game/random.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import type { SettlementState } from '../../src/game/types.ts';
import type { Ctx } from 'boardgame.io';
import { assignRoles } from '../../src/game/roles.ts';

const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

const stubCtx = (): Ctx =>
  ({
    numPlayers: 4,
    playOrder: ['0', '1', '2', '3'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'othersPhase',
    activePlayers: { '1': 'scienceTurn' },
  }) as unknown as Ctx;

const build4pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const wallets: Record<string, ReturnType<typeof bagOf>> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) wallets[seat] = bagOf({});
  }
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  return {
    bank: bagOf({}),
    centerMat: { circles: {}, tradeRequest: null },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    wallets,
    ...partial,
  };
};

const cardWith = (effects: EventEffect[]): EventCardDef => ({
  id: 'evt-test-001',
  color: 'gold',
  name: 'Test',
  effects,
});

describe('dispatch — gainResource (08.2)', () => {
  it('adds bag to G.bank when target is "bank"', () => {
    const G = build4pState({ bank: bagOf({ gold: 1 }) });
    const card = cardWith([
      { kind: 'gainResource', bag: { gold: 2, wood: 1 }, target: 'bank' },
    ]);

    dispatch(G, stubCtx(), fromBgio(identityRandom), card);

    expect(G.bank.gold).toBe(3);
    expect(G.bank.wood).toBe(1);
  });

  it('adds bag to the wallet of the seat holding the card-color\'s role', () => {
    // Blue card → science → 4-player layout: science is seat '1'.
    const G = build4pState();
    const blueCard: EventCardDef = {
      id: 'evt-blue-test',
      color: 'blue',
      name: 'Wallet Boost',
      effects: [
        { kind: 'gainResource', bag: { science: 2 }, target: 'wallet' },
      ],
    };

    dispatch(G, stubCtx(), fromBgio(identityRandom), blueCard);

    expect(G.wallets['1']!.science).toBe(2);
    // Bank untouched.
    expect(G.bank.gold).toBe(0);
  });
});

describe('dispatch — modifier effects (08.2)', () => {
  it('doubleScience pushes a modifier onto G._modifiers', () => {
    const G = build4pState();
    const card = cardWith([{ kind: 'doubleScience' }]);

    dispatch(G, stubCtx(), fromBgio(identityRandom), card);

    expect(hasModifierActive(G, 'doubleScience')).toBe(true);
    expect(G._modifiers).toHaveLength(1);
    expect(G._modifiers![0]!.kind).toBe('doubleScience');

    // consumeModifier removes the entry.
    consumeModifier(G, 'doubleScience');
    expect(hasModifierActive(G, 'doubleScience')).toBe(false);
  });

  it('forbidBuy pushes a modifier onto G._modifiers', () => {
    const G = build4pState();
    const card = cardWith([{ kind: 'forbidBuy' }]);

    dispatch(G, stubCtx(), fromBgio(identityRandom), card);

    expect(hasModifierActive(G, 'forbidBuy')).toBe(true);
    expect(G._modifiers).toHaveLength(1);
  });
});

describe('dispatch — awaiting-input effects (08.2)', () => {
  it('swapTwoScienceCards parks the effect on G._awaitingInput', () => {
    const G = build4pState();
    const card = cardWith([{ kind: 'swapTwoScienceCards' }]);

    // No `events` helper supplied — the dispatcher should still record
    // the awaiting-input slot. (Stage transition is then a no-op; the
    // play*Event move drives that path through bgio's events plugin.)
    dispatch(G, stubCtx(), fromBgio(identityRandom), card, undefined, {
      playerID: '1',
    });

    expect(G._awaitingInput).toBeDefined();
    expect(G._awaitingInput!['1']).toEqual({ kind: 'swapTwoScienceCards' });
  });
});

describe('dispatch — exhaustive (08.2)', () => {
  it('throws on an unknown effect kind', () => {
    const G = build4pState();
    // Cast through unknown so we can simulate JSON content drift.
    const bogus = {
      id: 'evt-bogus',
      color: 'gold',
      name: 'Bogus',
      effects: [{ kind: 'gainGold', amount: 1 } as unknown as EventEffect],
    } as EventCardDef;

    expect(() =>
      dispatch(G, stubCtx(), fromBgio(identityRandom), bogus),
    ).toThrow(/unknown effect kind/);
  });
});
