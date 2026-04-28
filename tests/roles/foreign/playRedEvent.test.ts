// Tests for foreignPlayRedEvent (07.6) — STUB.
//
// Mirrors tests/roles/chief/playGoldEvent.test.ts. Until 08.3 ships the
// typed effect dispatcher + concrete card surface, this move only owns
// gating + per-cycle / per-round bookkeeping. The tests below drive the
// move directly against a hand-built SettlementState + stub Ctx.
//
// We hand-build a stub `events` slice with one red card in the foreign
// seat's hand so the move's id-lookup has something to match. The deck
// pool matches the hand size so a single `cycleAdvance` driven by the
// move completes the cycle and clears `used`.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignPlayRedEvent } from '../../../src/game/roles/foreign/playRedEvent.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../../src/game/events/state.ts';

const stubRedCard: EventCardDef = {
  id: 'evt-red-001',
  color: 'red',
  name: 'Raid',
  effects: [],
};

const stubGreenCard: EventCardDef = {
  id: 'evt-green-001',
  color: 'green',
  name: 'Harvest',
  effects: [],
};

const stubEvents = (foreignSeat: string): EventsState => ({
  decks: {
    gold: [],
    blue: [],
    green: [stubGreenCard],
    red: [stubRedCard],
  },
  hands: {
    gold: {},
    blue: {},
    green: {},
    red: { [foreignSeat]: [stubRedCard] },
  },
  used: {
    gold: {},
    blue: {},
    green: {},
    red: { [foreignSeat]: [] },
  },
  playedThisRound: { [foreignSeat]: [] },
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
  const mv = foreignPlayRedEvent as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctx(), playerID }, cardID);
};

describe('foreignPlayRedEvent (07.6 stub)', () => {
  it('without G.events: returns INVALID_MOVE (08 not landed)', () => {
    const G = build2pState();
    const before = JSON.parse(JSON.stringify(G));

    // Seat '1' holds foreign in 2-player.
    const result = callPlay(G, '1', 'evt-red-001');

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('happy path: with stubbed events + foreign seat, marks foreign flag and advances cycle', () => {
    // In 2-player, seat '1' holds both domestic and foreign.
    const foreignSeat = '1';
    const G = build2pState({ events: stubEvents(foreignSeat) });

    const result = callPlay(G, foreignSeat, stubRedCard.id);

    expect(result).toBeUndefined();
    expect(G._eventPlayedThisRound).toBeDefined();
    expect(G._eventPlayedThisRound!.foreign).toBe(true);
    expect(G.events!.hands.red[foreignSeat]).toEqual([stubRedCard]);
    expect(G.events!.used.red[foreignSeat]).toEqual([]);
  });

  it('playing a second red event in the same round returns INVALID_MOVE', () => {
    const foreignSeat = '1';
    const G = build2pState({
      events: stubEvents(foreignSeat),
      _eventPlayedThisRound: { foreign: true },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, foreignSeat, stubRedCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('wrong color (green card not in foreign red hand) returns INVALID_MOVE', () => {
    const foreignSeat = '1';
    const G = build2pState({ events: stubEvents(foreignSeat) });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, foreignSeat, stubGreenCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
