// Tests for chiefPlayGoldEvent (04.4) — STUB.
//
// Until 08.3 ships the typed effect dispatcher + concrete card surface,
// this move only owns gating + per-cycle / per-round bookkeeping. The
// tests below drive the move directly against a hand-built SettlementState
// + stub Ctx (same pattern as chiefDistribute / chiefPlaceWorker tests).
//
// We hand-build a stub `events` slice with one gold card in the chief's
// hand so the move's id-lookup has something to match. The deck pool
// matches the hand size so a single `cycleAdvance` (driven by the move)
// completes the cycle and clears `used` — that's a side-effect we observe
// in test 2 for the bookkeeping flag, not as a load-bearing assertion.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { chiefPlayGoldEvent } from '../../../src/game/roles/chief/playGoldEvent.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../../src/game/events/state.ts';

// A single gold card in the chief's hand. Sized 1-of-1 so any later
// `cycleAdvance` triggered by the move completes the cycle and resets the
// `used` list (the cycle math is exercised in tests/events/cycle.test.ts;
// here we just need a deterministic hand for the lookup).
const stubGoldCard: EventCardDef = {
  id: 'evt-gold-001',
  color: 'gold',
  name: 'Bounty',
  effects: [],
};

const stubBlueCard: EventCardDef = {
  id: 'evt-blue-001',
  color: 'blue',
  name: 'Insight',
  effects: [],
};

// Build a minimal events slice keyed off the chief seat. `hands.gold` only
// has the stubGoldCard — that's the only legal cardID for the chief.
const stubEvents = (chiefSeat: string): EventsState => ({
  decks: {
    gold: [stubGoldCard],
    blue: [stubBlueCard],
    green: [],
    red: [],
  },
  hands: {
    gold: { [chiefSeat]: [stubGoldCard] },
    blue: {},
    green: {},
    red: {},
  },
  used: {
    gold: { [chiefSeat]: [] },
    blue: {},
    green: {},
    red: {},
  },
  playedThisRound: { [chiefSeat]: [] },
});

const build2pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const matCircles: Record<string, ReturnType<typeof bagOf>> = {};
  const wallets: Record<string, ReturnType<typeof bagOf>> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      matCircles[seat] = bagOf({});
      wallets[seat] = bagOf({});
    }
  }
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: { circles: matCircles, tradeRequest: null },
    roleAssignments,
    round: 1,
    hands,
    wallets,
    ...partial,
  };
};

const ctx = (): Ctx => ({ phase: 'chiefPhase' } as unknown as Ctx);

const callPlay = (
  G: SettlementState,
  playerID: string | undefined,
  cardID: string,
): typeof INVALID_MOVE | void => {
  const mv = chiefPlayGoldEvent as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctx(), playerID }, cardID);
};

describe('chiefPlayGoldEvent (04.4 stub)', () => {
  it('without G.events: returns INVALID_MOVE (08 not landed)', () => {
    // Build a state that has no events slice at all.
    const G = build2pState();
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, '0', 'evt-gold-001');

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('happy path: with stubbed events + chief seat, marks chief flag and advances cycle', () => {
    const chiefSeat = '0';
    const G = build2pState({ events: stubEvents(chiefSeat) });

    const result = callPlay(G, chiefSeat, stubGoldCard.id);

    expect(result).toBeUndefined();
    // Per-round ledger: chief's gold-event slot is now consumed.
    expect(G._eventPlayedThisRound).toBeDefined();
    expect(G._eventPlayedThisRound!.chief).toBe(true);
    // The hand isn't mutated by this stub (08.x's dispatcher / hand-mgmt
    // owns that). The card object is still the chief's only gold card.
    expect(G.events!.hands.gold[chiefSeat]).toEqual([stubGoldCard]);
    // `cycleAdvance` was driven: with deck size 1 and one used card the
    // cycle completes and `used` resets to empty. (Cycle math itself is
    // covered by tests/events/cycle.test.ts; here we just confirm the
    // move actually advanced the cycle rather than skipping it.)
    expect(G.events!.used.gold[chiefSeat]).toEqual([]);
  });

  it('playing a second gold event in the same round returns INVALID_MOVE', () => {
    const chiefSeat = '0';
    const G = build2pState({
      events: stubEvents(chiefSeat),
      _eventPlayedThisRound: { chief: true },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, chiefSeat, stubGoldCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('wrong color (blue card not in chief gold hand) returns INVALID_MOVE', () => {
    // The blue card exists in the deck pool but is NOT in hands.gold —
    // the move's id-lookup is gold-only, so this rejects.
    const chiefSeat = '0';
    const G = build2pState({ events: stubEvents(chiefSeat) });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, chiefSeat, stubBlueCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
