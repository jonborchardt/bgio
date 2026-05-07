// 08.3 — End-to-end tests for the four play*Event moves and the
// `eventResolve` follow-up move.
//
// The play*Event moves are exercised against hand-built SettlementState
// shells seeded with a single `gainResource` event in the role-holding
// seat's hand. `eventResolve` is exercised on the validation paths
// (wrong stage, no parked effect).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { chiefPlayGoldEvent } from '../../src/game/roles/chief/playGoldEvent.ts';
import { sciencePlayBlueEvent } from '../../src/game/roles/science/playBlueEvent.ts';
import { domesticPlayGreenEvent } from '../../src/game/roles/domestic/playGreenEvent.ts';
import { eventResolve } from '../../src/game/events/resolveMove.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { assignRoles } from '../../src/game/roles.ts';
import type { SettlementState } from '../../src/game/types.ts';
import type {
  EventCardDef,
  EventsState,
} from '../../src/game/events/state.ts';
import { initialMats } from '../../src/game/resources/playerMat.ts';

// 4-player layout puts every role on its own seat: chief='0',
// science='1', domestic='2', defense='3'. Removes any ambiguity about
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
    roleAssignments,
    round: 1,
    bossResolved: false,
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

  // The defense red play-event move is retired in 1.4 (D14);
  // Phase 2 will reintroduce it once the new defense card economy lands.
});

describe('eventResolve', () => {
  it('eventResolve outside the playingEvent stage returns INVALID_MOVE', () => {
    const G = build4pState({
      _awaitingInput: {
        '1': { kind: 'awaitInput', prompt: 'pick', payloadKind: 'pickN' },
      },
    });
    const mv = eventResolve as unknown as MoveFn<[unknown]>;
    const result = mv(
      {
        G,
        ctx: ctxOthersWith({ '1': 'scienceTurn' }),
        playerID: '1',
      },
      undefined,
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
      undefined,
    );
    expect(result).toBe(INVALID_MOVE);
  });
});
