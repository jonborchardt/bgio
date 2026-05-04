// Tests for domesticPlayGreenEvent (06.6) — STUB.
//
// Mirrors tests/roles/chief/playGoldEvent.test.ts. Until 08.3 ships the
// typed effect dispatcher + concrete card surface, this move only owns
// gating + per-cycle / per-round bookkeeping. The tests below drive the
// move directly against a hand-built SettlementState + stub Ctx.
//
// We hand-build a stub `events` slice with one green card in the
// domestic seat's hand so the move's id-lookup has something to match.
// The deck pool matches the hand size so a single `cycleAdvance` driven
// by the move completes the cycle and clears `used`.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticPlayGreenEvent } from '../../../src/game/roles/domestic/playGreenEvent.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../../src/game/events/state.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const stubGreenCard: EventCardDef = {
  id: 'evt-green-001',
  color: 'green',
  name: 'Harvest',
  effects: [],
};

const stubBlueCard: EventCardDef = {
  id: 'evt-blue-001',
  color: 'blue',
  name: 'Insight',
  effects: [],
};

const stubEvents = (domesticSeat: string): EventsState => ({
  decks: {
    gold: [],
    blue: [stubBlueCard],
    green: [stubGreenCard],
    red: [],
  },
  hands: {
    gold: {},
    blue: {},
    green: { [domesticSeat]: [stubGreenCard] },
    red: {},
  },
  used: {
    gold: {},
    blue: {},
    green: { [domesticSeat]: [] },
    red: {},
  },
  playedThisRound: { [domesticSeat]: [] },
});

const build2pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats: initialMats(roleAssignments),
    ...partial,
  };
};

const ctx = (): Ctx => ({ phase: 'othersPhase' } as unknown as Ctx);

const callPlay = (
  G: SettlementState,
  playerID: string | undefined,
  cardID: string,
): typeof INVALID_MOVE | void => {
  const mv = domesticPlayGreenEvent as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctx(), playerID }, cardID);
};

describe('domesticPlayGreenEvent (06.6 stub)', () => {
  it('without G.events: returns INVALID_MOVE (08 not landed)', () => {
    const G = build2pState();
    const before = JSON.parse(JSON.stringify(G));

    // Seat '1' holds domestic in 2-player.
    const result = callPlay(G, '1', 'evt-green-001');

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('happy path: with stubbed events + domestic seat, marks domestic flag and advances cycle', () => {
    // In 2-player, seat '1' holds both domestic and defense.
    const domesticSeat = '1';
    const G = build2pState({ events: stubEvents(domesticSeat) });

    const result = callPlay(G, domesticSeat, stubGreenCard.id);

    expect(result).toBeUndefined();
    expect(G._eventPlayedThisRound).toBeDefined();
    expect(G._eventPlayedThisRound!.domestic).toBe(true);
    expect(G.events!.hands.green[domesticSeat]).toEqual([stubGreenCard]);
    expect(G.events!.used.green[domesticSeat]).toEqual([]);
  });

  it('playing a second green event in the same round returns INVALID_MOVE', () => {
    const domesticSeat = '1';
    const G = build2pState({
      events: stubEvents(domesticSeat),
      _eventPlayedThisRound: { domestic: true },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, domesticSeat, stubGreenCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('wrong color (blue card not in domestic green hand) returns INVALID_MOVE', () => {
    const domesticSeat = '1';
    const G = build2pState({ events: stubEvents(domesticSeat) });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlay(G, domesticSeat, stubBlueCard.id);

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
