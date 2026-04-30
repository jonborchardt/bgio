// Tests for trade-request placement (07.5).
//
// Covers:
//   * `placeOrInterruptTrade` (called by `foreignFlipTrade`):
//       - empty slot → drops card straight into `centerMat.tradeRequest`
//       - occupied slot → stashes pending + flips
//         `G._awaitingChiefTradeDiscard`
//   * `chiefDecideTradeDiscard`:
//       - keep === 'new' → existing replaced with pending
//       - keep === 'existing' → pending discarded, slot unchanged
//       - clears flag + pending in both cases

import { describe, expect, it } from 'vitest';
import { INVALID_MOVE } from 'boardgame.io/core';
import { placeOrInterruptTrade } from '../../../src/game/roles/foreign/tradeRequest.ts';
import { chiefDecideTradeDiscard } from '../../../src/game/roles/chief/decideTradeDiscard.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type {
  SettlementState,
  ForeignState,
} from '../../../src/game/types.ts';
import type { TradeCardDef } from '../../../src/data/decks.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const build2pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: { tradeRequest: null },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats: initialMats(roleAssignments),
    foreign: emptyForeign(),
    ...partial,
  };
};

const cardA: TradeCardDef = {
  id: 'tra-A',
  number: 1,
  required: { wood: 1 },
  reward: { gold: 2 },
};
const cardB: TradeCardDef = {
  id: 'tra-B',
  number: 1,
  required: { food: 1 },
  reward: { gold: 3 },
};

const callDiscard = (
  G: SettlementState,
  playerID: string | undefined,
  keep: 'existing' | 'new',
): typeof INVALID_MOVE | void => {
  const mv = chiefDecideTradeDiscard as unknown as (
    args: { G: SettlementState; playerID: string | undefined },
    keep: 'existing' | 'new',
  ) => typeof INVALID_MOVE | void;
  return mv({ G, playerID }, keep);
};

describe('placeOrInterruptTrade (07.5)', () => {
  it('first trade: empty slot → drops drawn card into mat.tradeRequest', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');

    expect(G.centerMat.tradeRequest).not.toBeNull();
    expect(G.centerMat.tradeRequest!.id).toBe('tra-A');
    expect(G.centerMat.tradeRequest!.ownerSeat).toBe('1');
    expect(G.centerMat.tradeRequest!.required).toEqual(bagOf({ wood: 1 }));
    expect(G.centerMat.tradeRequest!.reward).toEqual(bagOf({ gold: 2 }));
    expect(G.foreign!.pendingTrade).toBeUndefined();
    expect(G._awaitingChiefTradeDiscard).toBeUndefined();
  });

  it('second trade: slot occupied → stashes pending and sets _awaitingChiefTradeDiscard', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');
    // Verify the first one landed in the slot.
    expect(G.centerMat.tradeRequest!.id).toBe('tra-A');

    placeOrInterruptTrade(G, cardB, '1');

    expect(G.centerMat.tradeRequest!.id).toBe('tra-A'); // unchanged
    expect(G.foreign!.pendingTrade).toEqual(cardB);
    expect(G._awaitingChiefTradeDiscard).toBe(true);
  });
});

describe('chiefDecideTradeDiscard (07.5)', () => {
  it('keep "new": pending replaces mat slot; flag + pending cleared', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');
    placeOrInterruptTrade(G, cardB, '1');
    expect(G._awaitingChiefTradeDiscard).toBe(true);

    // Seat '0' is the chief seat in 2p assignments.
    const result = callDiscard(G, '0', 'new');
    expect(result).toBeUndefined();

    expect(G.centerMat.tradeRequest!.id).toBe('tra-B');
    expect(G.centerMat.tradeRequest!.ownerSeat).toBe('1');
    expect(G.centerMat.tradeRequest!.required).toEqual(bagOf({ food: 1 }));
    expect(G.foreign!.pendingTrade).toBeUndefined();
    expect(G._awaitingChiefTradeDiscard).toBe(false);
  });

  it('keep "existing": pending discarded; mat slot unchanged', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');
    placeOrInterruptTrade(G, cardB, '1');

    const result = callDiscard(G, '0', 'existing');
    expect(result).toBeUndefined();

    expect(G.centerMat.tradeRequest!.id).toBe('tra-A'); // unchanged
    expect(G.foreign!.pendingTrade).toBeUndefined();
    expect(G._awaitingChiefTradeDiscard).toBe(false);
  });

  it('rejects when caller is not the chief', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');
    placeOrInterruptTrade(G, cardB, '1');

    // Seat '1' holds domestic+foreign in 2p, NOT chief.
    const result = callDiscard(G, '1', 'new');
    expect(result).toBe(INVALID_MOVE);
    expect(G._awaitingChiefTradeDiscard).toBe(true);
    expect(G.foreign!.pendingTrade).toEqual(cardB);
  });

  it('rejects when no decision is pending', () => {
    const G = build2pState();
    // No pending trade, flag never raised.
    const result = callDiscard(G, '0', 'new');
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects an unknown keep value', () => {
    const G = build2pState();
    placeOrInterruptTrade(G, cardA, '1');
    placeOrInterruptTrade(G, cardB, '1');

    const result = callDiscard(
      G,
      '0',
      'bogus' as unknown as 'existing' | 'new',
    );
    expect(result).toBe(INVALID_MOVE);
    expect(G._awaitingChiefTradeDiscard).toBe(true);
  });
});
