// SL fix-1 — `scienceLibraryBuy` event-card routing tests.
//
// When the bought card is `kind: 'event'`, the def must land in
// `G.events.hands[scienceColor][holderSeat]` so the matching per-color
// `play<Color>Event` move can dispatch it. Routing through the legacy
// per-role `hand` would leave the event unplayable forever.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import type { INVALID_MOVE } from 'boardgame.io/core';
import { scienceLibraryBuy } from '../../../../src/game/roles/science/libraryBuy.ts';
import { chiefPlayGoldEvent } from '../../../../src/game/roles/chief/playGoldEvent.ts';
import { assignRoles, seatOfRole } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import { emptyLibraryState } from '../../../../src/game/library/state.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type { LibraryCard } from '../../../../src/game/library/types.ts';
import type { LibraryColor } from '../../../../src/data/schema.ts';

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const fakeEvent = (
  scienceColor: LibraryColor,
  id: string,
): LibraryCard => ({
  kind: 'event',
  tier: 1,
  scienceColor,
  def: {
    id,
    color: scienceColor,
    name: id,
    effects: [],
    tier: 1,
    scienceColor,
  },
});

const buildState = (opts: {
  numPlayers: 1 | 2 | 3 | 4;
  scienceSeat: string;
  rowCards: ReadonlyArray<LibraryCard | null>;
  stash?: { gold?: number; science?: number };
  bankGold?: number;
  bankScience?: number;
}): SettlementState => {
  const roleAssignments = assignRoles(opts.numPlayers);
  const mats = initialMats(roleAssignments);
  if (opts.stash !== undefined && mats[opts.scienceSeat] !== undefined) {
    mats[opts.scienceSeat] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf(opts.stash),
    };
  }

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const seats = Object.keys(roleAssignments);
  const lib = emptyLibraryState(seats);
  for (let i = 0; i < lib.row.length; i++) {
    lib.row[i] = opts.rowCards[i] ?? null;
  }

  // Build a real-shaped events slice so routing has a place to land.
  const playedThisRound: Record<string, LibraryColor[]> = {};
  for (const seat of seats) playedThisRound[seat] = [];

  return {
    bank: bagOf({
      gold: opts.bankGold ?? 0,
      science: opts.bankScience ?? 0,
    }),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: { hand: [] },
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [], techHand: [] },
    chief: { workers: 0, hand: [] },
    library: lib,
    events: {
      decks: { gold: [], blue: [], green: [], red: [] },
      hands: { gold: {}, blue: {}, green: {}, red: {} },
      used: { gold: {}, blue: {}, green: {}, red: {} },
      playedThisRound,
    },
  };
};

const callBuy = (
  G: SettlementState,
  playerID: string,
  slot: number,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBuy as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctxScienceTurn(playerID), playerID }, slot);
};

describe('scienceLibraryBuy — event routing (SL fix-1)', () => {
  it('gold event lands on the chief seat\'s G.events.hands.gold, not G.chief.hand', () => {
    const card = fakeEvent('gold', 'evt-1');
    const G = buildState({
      numPlayers: 4,
      scienceSeat: '1',
      rowCards: [card, null, null, null, null, null],
      stash: { gold: 50 },
    });
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');

    expect(callBuy(G, '1', 0)).toBeUndefined();

    const goldHand = G.events!.hands.gold[chiefSeat];
    expect(goldHand).toBeDefined();
    expect(goldHand).toHaveLength(1);
    expect(goldHand![0]!.id).toBe('evt-1');
    expect(G.chief!.hand ?? []).toHaveLength(0);
  });

  it('the bought event is then playable through chiefPlayGoldEvent', () => {
    const card = fakeEvent('gold', 'evt-playable');
    const G = buildState({
      numPlayers: 4,
      scienceSeat: '1',
      rowCards: [card, null, null, null, null, null],
      stash: { gold: 50 },
    });
    const chiefSeat = seatOfRole(G.roleAssignments, 'chief');

    callBuy(G, '1', 0);

    // Drive `chiefPlayGoldEvent` directly. cycleAdvance compares the
    // chief seat's `used.gold` length against `decks.gold.length`, so
    // both slots have to exist before the play move runs.
    if (card.kind !== 'event') throw new Error('test fixture: expected event');
    G.events!.decks.gold = [card.def];
    G.events!.used.gold[chiefSeat] = [];
    const ctx = {
      phase: 'chiefPhase',
      activePlayers: { [chiefSeat]: 'chiefMain' },
    } as unknown as Ctx;
    const playMove = chiefPlayGoldEvent as unknown as (
      args: {
        G: SettlementState;
        ctx: Ctx;
        playerID: string;
        random?: undefined;
        events?: undefined;
      },
      cardId: string,
    ) => typeof INVALID_MOVE | void;
    const result = playMove(
      { G, ctx, playerID: chiefSeat },
      'evt-playable',
    );
    // The card is reachable from the gold hand — chiefPlayGoldEvent did
    // not bail with INVALID_MOVE on the "card not in hand" check.
    expect(result).toBeUndefined();
    expect(G._eventPlayedThisRound?.chief).toBe(true);
  });

  it('blue event lands on the science seat\'s G.events.hands.blue', () => {
    const card = fakeEvent('blue', 'b-evt');
    const G = buildState({
      numPlayers: 4,
      scienceSeat: '1',
      rowCards: [card, null, null, null, null, null],
      stash: { science: 50 },
    });

    expect(callBuy(G, '1', 0)).toBeUndefined();

    const blueHand = G.events!.hands.blue['1'];
    expect(blueHand).toBeDefined();
    expect(blueHand).toHaveLength(1);
    expect(blueHand![0]!.id).toBe('b-evt');
  });
});
