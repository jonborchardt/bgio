// 08.3 — End-to-end tests for the four play*Event moves and the
// `eventResolve` follow-up move.
//
// The play*Event moves are exercised against hand-built SettlementState
// shells (the same fixture pattern as
// tests/roles/<role>/play<Color>Event.test.ts) seeded with a single
// `gainResource` event in the role-holding seat's hand. We assert the
// dispatched effect actually fires (bank / wallet credited).
//
// `eventResolve` is exercised in two paths: the swap path (via
// `swapTwoScienceCards`) and the validation path (calling outside the
// `playingEvent` stage rejects).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { chiefPlayGoldEvent } from '../../src/game/roles/chief/playGoldEvent.ts';
import { sciencePlayBlueEvent } from '../../src/game/roles/science/playBlueEvent.ts';
import { domesticPlayGreenEvent } from '../../src/game/roles/domestic/playGreenEvent.ts';
import { foreignPlayRedEvent } from '../../src/game/roles/foreign/playRedEvent.ts';
import { eventResolve } from '../../src/game/events/resolveMove.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { assignRoles } from '../../src/game/roles.ts';
import type { SettlementState } from '../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../src/game/events/state.ts';
import type { ScienceCardDef } from '../../src/data/scienceCards.ts';
import type { ScienceState } from '../../src/game/roles/science/setup.ts';
import { initialMats } from '../../src/game/resources/playerMat.ts';

// 4-player layout puts every role on its own seat: chief='0',
// science='1', domestic='2', foreign='3'. Removes any ambiguity about
// which seat a stash credit should land on.
const FOUR_P = (): ReturnType<typeof assignRoles> => assignRoles(4);

// Build a baseline 4-player state with empty mats per non-chief seat.
const build4pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = FOUR_P();
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
    _stageStack: {},
    ...partial,
  };
};

// Build an EventsState with a single card of `color` in `seat`'s hand.
const eventsWithOne = (
  color: 'gold' | 'blue' | 'green' | 'red',
  seat: string,
  card: EventCardDef,
): EventsState => ({
  decks: { gold: [], blue: [], green: [], red: [], [color]: [card] } as Record<
    'gold' | 'blue' | 'green' | 'red',
    EventCardDef[]
  >,
  hands: {
    gold: {},
    blue: {},
    green: {},
    red: {},
    [color]: { [seat]: [card] },
  } as Record<'gold' | 'blue' | 'green' | 'red', Record<string, EventCardDef[]>>,
  used: {
    gold: {},
    blue: {},
    green: {},
    red: {},
    [color]: { [seat]: [] },
  } as Record<'gold' | 'blue' | 'green' | 'red', Record<string, string[]>>,
  playedThisRound: { [seat]: [] },
});

const ctxOthersWith = (
  activePlayers: Record<string, string> | undefined = undefined,
): Ctx =>
  ({ phase: 'othersPhase', activePlayers } as unknown as Ctx);

const ctxChief = (): Ctx => ({ phase: 'chiefPhase' } as unknown as Ctx);

// Generic move shape we pass to bgio-style moves in headless tests.
type MoveArg = {
  G: SettlementState;
  ctx: Ctx;
  playerID: string | undefined;
  random?: unknown;
  events?: unknown;
};
type MoveFn<P extends unknown[]> = (
  a: MoveArg,
  ...args: P
) => typeof INVALID_MOVE | void;

describe('play*Event end-to-end (08.3)', () => {
  it('chiefPlayGoldEvent: gainResource(target=bank) credits G.bank', () => {
    const card: EventCardDef = {
      id: 'evt-gold-test',
      color: 'gold',
      name: 'Bounty',
      effects: [{ kind: 'gainResource', bag: { gold: 2 }, target: 'bank' }],
    };
    const G = build4pState({ events: eventsWithOne('gold', '0', card) });
    const mv = chiefPlayGoldEvent as unknown as MoveFn<[string]>;
    const result = mv(
      { G, ctx: ctxChief(), playerID: '0' },
      card.id,
    );
    expect(result).toBeUndefined();
    expect(G.bank.gold).toBe(2);
    expect(G._eventPlayedThisRound!.chief).toBe(true);
  });

  it('sciencePlayBlueEvent: gainResource(target=wallet) credits the science seat\'s wallet', () => {
    const card: EventCardDef = {
      id: 'evt-blue-test',
      color: 'blue',
      name: 'Insight',
      effects: [
        { kind: 'gainResource', bag: { science: 2 }, target: 'wallet' },
      ],
    };
    const G = build4pState({ events: eventsWithOne('blue', '1', card) });
    const mv = sciencePlayBlueEvent as unknown as MoveFn<[string]>;
    const result = mv(
      { G, ctx: ctxOthersWith({ '1': 'scienceTurn' }), playerID: '1' },
      card.id,
    );
    expect(result).toBeUndefined();
    expect(G.mats['1']!.stash.science).toBe(2);
    expect(G._eventPlayedThisRound!.science).toBe(true);
  });

  it('domesticPlayGreenEvent: gainResource(target=wallet) credits the domestic seat\'s wallet', () => {
    const card: EventCardDef = {
      id: 'evt-green-test',
      color: 'green',
      name: 'Harvest',
      effects: [
        { kind: 'gainResource', bag: { food: 1 }, target: 'wallet' },
      ],
    };
    const G = build4pState({ events: eventsWithOne('green', '2', card) });
    const mv = domesticPlayGreenEvent as unknown as MoveFn<[string]>;
    const result = mv(
      { G, ctx: ctxOthersWith({ '2': 'domesticTurn' }), playerID: '2' },
      card.id,
    );
    expect(result).toBeUndefined();
    expect(G.mats['2']!.stash.food).toBe(1);
    expect(G._eventPlayedThisRound!.domestic).toBe(true);
  });

  it('foreignPlayRedEvent: gainResource(target=wallet) credits the foreign seat\'s wallet', () => {
    const card: EventCardDef = {
      id: 'evt-red-test',
      color: 'red',
      name: 'Skirmish',
      effects: [
        { kind: 'gainResource', bag: { steel: 1 }, target: 'wallet' },
      ],
    };
    const G = build4pState({ events: eventsWithOne('red', '3', card) });
    const mv = foreignPlayRedEvent as unknown as MoveFn<[string]>;
    const result = mv(
      { G, ctx: ctxOthersWith({ '3': 'foreignTurn' }), playerID: '3' },
      card.id,
    );
    expect(result).toBeUndefined();
    expect(G.mats['3']!.stash.steel).toBe(1);
    expect(G._eventPlayedThisRound!.foreign).toBe(true);
  });
});

describe('eventResolve (08.3)', () => {
  // Build a tiny science-state stub with two cards in the grid we can
  // swap. Only `grid` matters for the swap; the other ScienceState
  // slots are shaped just enough to satisfy the type.
  const stubScienceCard = (
    id: string,
    color: 'red' | 'gold' | 'green' | 'blue',
  ): ScienceCardDef => ({
    id,
    color,
    tier: 'beginner',
    level: 0,
    cost: { gold: 1 },
  });

  const stubScience = (a: ScienceCardDef, b: ScienceCardDef): ScienceState => ({
    grid: [[a], [b]],
    underCards: {},
    paid: {},
    completed: [],
    perRoundCompletions: 0,
    hand: [],
  });

  it('swapTwoScienceCards: dispatches awaitInput → eventResolve swaps grid and exits stage', () => {
    // 1) play the card (effect = swapTwoScienceCards). The dispatcher
    //    parks the effect on G._awaitingInput[seat] and pushes the
    //    seat into the playingEvent stage.
    const card: EventCardDef = {
      id: 'evt-blue-swap',
      color: 'blue',
      name: 'Library Reorg',
      effects: [{ kind: 'swapTwoScienceCards' }],
    };
    const a = stubScienceCard('sci-a', 'gold');
    const b = stubScienceCard('sci-b', 'green');
    const G = build4pState({
      events: eventsWithOne('blue', '1', card),
      science: stubScience(a, b),
    });

    // Capture setStage calls so we can assert the stage transitions.
    const stageCalls: string[] = [];
    const eventsHelper = {
      setStage: (s: string) => stageCalls.push(s),
    };

    const mvPlay = sciencePlayBlueEvent as unknown as MoveFn<[string]>;
    const playResult = mvPlay(
      {
        G,
        ctx: ctxOthersWith({ '1': 'scienceTurn' }),
        playerID: '1',
        events: eventsHelper,
      },
      card.id,
    );
    expect(playResult).toBeUndefined();
    expect(G._awaitingInput).toBeDefined();
    expect(G._awaitingInput!['1']!.kind).toBe('swapTwoScienceCards');
    expect(stageCalls).toContain('playingEvent');
    expect(G._stageStack!['1']).toEqual(['scienceTurn']);

    // 2) call eventResolve with the two card ids — the seat is now in
    //    playingEvent so the stage gate accepts.
    const mvResolve = eventResolve as unknown as MoveFn<[unknown]>;
    const resolveResult = mvResolve(
      {
        G,
        ctx: ctxOthersWith({ '1': 'playingEvent' }),
        playerID: '1',
        events: eventsHelper,
      },
      { a: 'sci-a', b: 'sci-b' },
    );
    expect(resolveResult).toBeUndefined();

    // The grid is swapped: [['sci-a'], ['sci-b']] becomes
    // [['sci-b'], ['sci-a']].
    expect(G.science!.grid[0]![0]!.id).toBe('sci-b');
    expect(G.science!.grid[1]![0]!.id).toBe('sci-a');
    // Awaiting-input slot cleared.
    expect(G._awaitingInput!['1']).toBeUndefined();
    // Stage popped back to scienceTurn.
    expect(stageCalls.at(-1)).toBe('scienceTurn');
    expect(G._stageStack!['1']).toEqual([]);
  });

  it('eventResolve outside the playingEvent stage returns INVALID_MOVE', () => {
    const G = build4pState({ _awaitingInput: { '1': { kind: 'swapTwoScienceCards' } } });
    const mv = eventResolve as unknown as MoveFn<[unknown]>;
    const result = mv(
      {
        G,
        ctx: ctxOthersWith({ '1': 'scienceTurn' }),
        playerID: '1',
      },
      { a: 'x', b: 'y' },
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('eventResolve with no parked effect returns INVALID_MOVE', () => {
    const G = build4pState();
    const mv = eventResolve as unknown as MoveFn<[unknown]>;
    const result = mv(
      {
        G,
        ctx: ctxOthersWith({ '1': 'playingEvent' }),
        playerID: '1',
      },
      { a: 'x', b: 'y' },
    );
    expect(result).toBe(INVALID_MOVE);
  });
});
