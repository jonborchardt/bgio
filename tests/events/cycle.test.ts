// 08.1 — Event deck shape & per-seat cycle bookkeeping.
//
// Drives `setupEvents` and `cycleAdvance` against deterministic stubs, and
// runs the round-end hook directly via `runRoundEndHooks` to confirm
// `playedThisRound` resets at the top of each round.

import type { Ctx } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import {
  setupEvents,
  cycleAdvance,
  type EventsState,
} from '../../src/game/events/state.ts';
import {
  runRoundEndHooks,
  type RandomAPI as HookRandomAPI,
} from '../../src/game/hooks.ts';
import { fromBgio, type BgioRandomLike } from '../../src/game/random.ts';
import type { PlayerID, Role, SettlementState } from '../../src/game/types.ts';
import { EMPTY_BAG } from '../../src/game/resources/types.ts';

// Importing `setupEvents` above also runs its module-load side effect that
// registers `events:reset-played-this-round` in the round-end hook
// registry — that's what the third test exercises.

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
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const stubHookRandom = (): HookRandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

// 4-player layout — every role lives on its own seat, which makes per-color
// dealing checks unambiguous (one seat per color).
const FOUR_PLAYER_ASSIGNMENTS: Record<PlayerID, Role[]> = {
  '0': ['chief'],
  '1': ['science'],
  '2': ['domestic'],
  '3': ['foreign'],
};

// Build a SettlementState shell around an EventsState so we can drive the
// round-end hook against a realistic G shape.
const wrapInG = (events: EventsState): SettlementState => ({
  bank: { ...EMPTY_BAG },
  centerMat: { tradeRequest: null },
  roleAssignments: FOUR_PLAYER_ASSIGNMENTS,
  round: 0,
  settlementsJoined: 0,
  hands: { '0': {}, '1': {}, '2': {}, '3': {} },
  mats: {
    '1': { in: { ...EMPTY_BAG }, out: { ...EMPTY_BAG }, stash: { ...EMPTY_BAG } },
    '2': { in: { ...EMPTY_BAG }, out: { ...EMPTY_BAG }, stash: { ...EMPTY_BAG } },
    '3': { in: { ...EMPTY_BAG }, out: { ...EMPTY_BAG }, stash: { ...EMPTY_BAG } },
  },
  events,
});

describe('setupEvents (08.1)', () => {
  it('deals 4 cards of each color into the role-holding seat\'s hand', () => {
    const events = setupEvents(
      FOUR_PLAYER_ASSIGNMENTS,
      fromBgio(identityRandom),
    );

    // Role → color → seat:
    //   chief    → gold   → seat '0'
    //   science  → blue   → seat '1'
    //   domestic → green  → seat '2'
    //   foreign  → red    → seat '3'
    expect(events.hands.gold['0']).toBeDefined();
    expect(events.hands.gold['0']).toHaveLength(4);
    expect(events.hands.gold['0']!.every((c) => c.color === 'gold')).toBe(
      true,
    );

    expect(events.hands.blue['1']).toBeDefined();
    expect(events.hands.blue['1']).toHaveLength(4);
    expect(events.hands.blue['1']!.every((c) => c.color === 'blue')).toBe(
      true,
    );

    expect(events.hands.green['2']).toBeDefined();
    expect(events.hands.green['2']).toHaveLength(4);
    expect(events.hands.green['2']!.every((c) => c.color === 'green')).toBe(
      true,
    );

    expect(events.hands.red['3']).toBeDefined();
    expect(events.hands.red['3']).toHaveLength(4);
    expect(events.hands.red['3']!.every((c) => c.color === 'red')).toBe(
      true,
    );

    // Hands for the *wrong* color (e.g. seat 0 + blue) are absent.
    expect(events.hands.blue['0']).toBeUndefined();
    expect(events.hands.gold['1']).toBeUndefined();

    // The master deck pool keeps all 4 cards per color — drawing didn't
    // deplete it. Card references are shared between deck and hand.
    expect(events.decks.gold).toHaveLength(4);
    expect(events.decks.blue).toHaveLength(4);
    expect(events.decks.green).toHaveLength(4);
    expect(events.decks.red).toHaveLength(4);

    // used[color][seat] is initialized empty for the holding seat.
    expect(events.used.gold['0']).toEqual([]);
    expect(events.used.blue['1']).toEqual([]);
    expect(events.used.green['2']).toEqual([]);
    expect(events.used.red['3']).toEqual([]);

    // playedThisRound is initialized empty per seat.
    expect(events.playedThisRound).toEqual({
      '0': [],
      '1': [],
      '2': [],
      '3': [],
    });
  });
});

describe('cycleAdvance (08.1)', () => {
  it('after 4 cycleAdvance calls, used resets so the pool reopens', () => {
    const events = setupEvents(
      FOUR_PLAYER_ASSIGNMENTS,
      fromBgio(identityRandom),
    );

    // The four card ids dealt into seat 0's gold hand. The deck and the
    // hand share references, so we can take ids straight off the hand.
    const goldIds = events.hands.gold['0']!.map((c) => c.id);
    expect(goldIds).toHaveLength(4);

    cycleAdvance(events, 'gold', '0', goldIds[0]!);
    expect(events.used.gold['0']).toEqual([goldIds[0]]);

    cycleAdvance(events, 'gold', '0', goldIds[1]!);
    expect(events.used.gold['0']).toEqual([goldIds[0], goldIds[1]]);

    cycleAdvance(events, 'gold', '0', goldIds[2]!);
    expect(events.used.gold['0']).toEqual([
      goldIds[0],
      goldIds[1],
      goldIds[2],
    ]);

    // Fourth call completes the cycle: used clears, the pool of 4 reopens.
    cycleAdvance(events, 'gold', '0', goldIds[3]!);
    expect(events.used.gold['0']).toEqual([]);

    // The deck still has all 4 cards (it's the cycle reset pool, not a
    // draw pile that depleted).
    expect(events.decks.gold).toHaveLength(4);
    // The hand is also still intact — cycleAdvance doesn't touch the hand;
    // 08.2's playEvent move will be responsible for any hand mutation.
    expect(events.hands.gold['0']).toHaveLength(4);
  });

  it('two seats play different cards; cycles tracked independently', () => {
    // 4-player layout puts gold on seat 0 and blue on seat 1. Drive
    // cycleAdvance for both seats and confirm their used lists don't
    // interfere with each other.
    const events = setupEvents(
      FOUR_PLAYER_ASSIGNMENTS,
      fromBgio(identityRandom),
    );

    const goldIds = events.hands.gold['0']!.map((c) => c.id);
    const blueIds = events.hands.blue['1']!.map((c) => c.id);

    // Seat 0 plays two gold cards.
    cycleAdvance(events, 'gold', '0', goldIds[0]!);
    cycleAdvance(events, 'gold', '0', goldIds[1]!);

    // Seat 1 plays one blue card.
    cycleAdvance(events, 'blue', '1', blueIds[0]!);

    // Seats track their own cycles — gold list grew by 2, blue by 1, and
    // neither bled into the other (no entries under the wrong key).
    expect(events.used.gold['0']).toEqual([goldIds[0], goldIds[1]]);
    expect(events.used.blue['1']).toEqual([blueIds[0]]);

    // Cross-key buckets are still untouched / undefined.
    expect(events.used.gold['1']).toBeUndefined();
    expect(events.used.blue['0']).toBeUndefined();

    // Now seat 1 finishes their blue cycle (3 more plays, 4th resets).
    cycleAdvance(events, 'blue', '1', blueIds[1]!);
    cycleAdvance(events, 'blue', '1', blueIds[2]!);
    cycleAdvance(events, 'blue', '1', blueIds[3]!);
    expect(events.used.blue['1']).toEqual([]);

    // Seat 0's gold cycle is unaffected by seat 1 finishing blue.
    expect(events.used.gold['0']).toEqual([goldIds[0], goldIds[1]]);
  });
});

describe('events:reset-played-this-round hook (08.1)', () => {
  it('clears playedThisRound for every seat at endOfRound', () => {
    const events = setupEvents(
      FOUR_PLAYER_ASSIGNMENTS,
      fromBgio(identityRandom),
    );

    // Pretend each seat played one card of their color this round.
    events.playedThisRound['0'] = ['gold'];
    events.playedThisRound['1'] = ['blue'];
    events.playedThisRound['2'] = ['green'];
    events.playedThisRound['3'] = ['red'];

    const G = wrapInG(events);
    runRoundEndHooks(G, stubCtx(), stubHookRandom());

    // The hook resets every seat's playedThisRound to an empty list. Other
    // event state — decks, hands, used — is untouched.
    expect(G.events!.playedThisRound).toEqual({
      '0': [],
      '1': [],
      '2': [],
      '3': [],
    });
    expect(G.events!.decks.gold).toHaveLength(4);
    expect(G.events!.hands.gold['0']).toHaveLength(4);
    expect(G.events!.used.gold['0']).toEqual([]);
  });
});
