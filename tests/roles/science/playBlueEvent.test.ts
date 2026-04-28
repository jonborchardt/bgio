// Tests for sciencePlayBlueEvent (05.4) — STUB.
//
// Mirrors tests/roles/chief/playGoldEvent.test.ts. Until 08.3 ships the
// typed effect dispatcher + concrete card surface, this move only owns
// gating + per-cycle / per-round bookkeeping. The tests below drive the
// move directly against a hand-built SettlementState + stub Ctx.
//
// We hand-build a stub `events` slice with one blue card in the science
// seat's hand so the move's id-lookup has something to match. The deck
// pool matches the hand size so a single `cycleAdvance` (driven by the
// move) completes the cycle and clears `used` — that's a side-effect we
// observe in test 2 for the bookkeeping flag, not as a load-bearing
// assertion.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { sciencePlayBlueEvent } from '../../../src/game/roles/science/playBlueEvent.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../../src/game/events/state.ts';

// A single blue card in the science seat's hand. Sized 1-of-1 so any
// `cycleAdvance` triggered by the move completes the cycle and resets
// the `used` list.
const stubBlueCard: EventCardDef = {
  id: 'evt-blue-001',
  color: 'blue',
  name: 'Insight',
  effects: [],
};

const stubGoldCard: EventCardDef = {
  id: 'evt-gold-001',
  color: 'gold',
  name: 'Bounty',
  effects: [],
};

// Build a minimal events slice keyed off the science seat. `hands.blue`
// only has the stubBlueCard — that's the only legal cardID for the
// science seat.
const stubEvents = (scienceSeat: string): EventsState => ({
  decks: {
    gold: [stubGoldCard],
    blue: [stubBlueCard],
    green: [],
    red: [],
  },
  hands: {
    gold: {},
    blue: { [scienceSeat]: [stubBlueCard] },
    green: {},
    red: {},
  },
  used: {
    gold: {},
    blue: { [scienceSeat]: [] },
    green: {},
    red: {},
  },
  playedThisRound: { [scienceSeat]: [] },
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
    settlementsJoined: 0,
    hands,
    wallets,
    ...partial,
  };
};

const ctx = (): Ctx => ({ phase: 'othersPhase' } as unknown as Ctx);

const callPlay = (
  G: SettlementState,
  playerID: string | undefined,
  cardID: string,
): typeof INVALID_MOVE | void => {
  const mv = sciencePlayBlueEvent as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctx(), playerID }, cardID);
};

describe('sciencePlayBlueEvent (05.4 stub)', () => {
  it('without G.events: returns INVALID_MOVE (08 not landed)', () => {
    const G = build2pState();
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, '0', 'evt-blue-001');

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('happy path: with stubbed events + science seat, marks science flag and advances cycle', () => {
    // In 2-player, seat '0' holds both chief and science.
    const scienceSeat = '0';
    const G = build2pState({ events: stubEvents(scienceSeat) });

    const result = callPlay(G, scienceSeat, stubBlueCard.id);

    expect(result).toBeUndefined();
    expect(G._eventPlayedThisRound).toBeDefined();
    expect(G._eventPlayedThisRound!.science).toBe(true);
    expect(G.events!.hands.blue[scienceSeat]).toEqual([stubBlueCard]);
    expect(G.events!.used.blue[scienceSeat]).toEqual([]);
  });

  it('playing a second blue event in the same round returns INVALID_MOVE', () => {
    const scienceSeat = '0';
    const G = build2pState({
      events: stubEvents(scienceSeat),
      _eventPlayedThisRound: { science: true },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, scienceSeat, stubBlueCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('wrong color (gold card not in science blue hand) returns INVALID_MOVE', () => {
    // The gold card exists in the deck pool but is NOT in hands.blue —
    // the move's id-lookup is blue-only, so this rejects.
    const scienceSeat = '0';
    const G = build2pState({ events: stubEvents(scienceSeat) });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, scienceSeat, stubGoldCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
