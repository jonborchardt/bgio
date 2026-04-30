// Tests for foreignSeatDone (14.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignSeatDone } from '../../../src/game/roles/foreign/seatDone.ts';
import { makeClient } from '../../helpers/makeClient.ts';
import { runMoves } from '../../helpers/runMoves.ts';
import { seatOfRole, assignRoles } from '../../../src/game/roles.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const ctxAt = (seat: string, stage: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: stage },
  }) as unknown as Ctx;

const baseState = (): SettlementState => {
  const roleAssignments = assignRoles(4);
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
  };
};

const callSeatDone = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
): typeof INVALID_MOVE | void => {
  const mv = foreignSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('foreignSeatDone (14.2)', () => {
  it('flips G.othersDone[seat] when called from foreignTurn', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const foreignSeat = seatOfRole(assignments, 'foreign');

    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    runMoves(client, [{ player: foreignSeat, move: 'foreignSeatDone' }]);
    expect(client.getState()!.G.othersDone?.[foreignSeat]).toBe(true);
  });

  it('also accepted from foreignAwaitingDamage so a battle interrupt is escapable', () => {
    const G = baseState();
    // Seat '3' is the foreign seat in 4p.
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignAwaitingDamage'));
    expect(result).toBeUndefined();
    expect(G.othersDone?.['3']).toBe(true);
  });

  it('out-of-stage call returns INVALID_MOVE', () => {
    const G = baseState();
    const result = callSeatDone(G, '3', ctxAt('3', 'domesticTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['3']).toBeUndefined();
  });

  it('wrong-role seat returns INVALID_MOVE', () => {
    const G = baseState();
    // Seat '2' is domestic in 4p — calling foreignSeatDone from there
    // must reject.
    const result = callSeatDone(G, '2', ctxAt('2', 'foreignTurn'));
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when units are in play and upkeep is unpaid', () => {
    const G = baseState();
    G.foreign = {
      hand: [],
      inPlay: [{ defID: 'Militia', count: 2 }],
      battleDeck: [],
      tradeDeck: [],
      inFlight: { battle: null, committed: [] },
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['3']).toBeUndefined();
  });

  it('passes when units are in play but upkeep has been paid', () => {
    const G = baseState();
    G.foreign = {
      hand: [],
      inPlay: [{ defID: 'Militia', count: 2 }],
      battleDeck: [],
      tradeDeck: [],
      inFlight: { battle: null, committed: [] },
      _upkeepPaid: true,
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignTurn'));
    expect(result).toBeUndefined();
    expect(G.othersDone?.['3']).toBe(true);
  });

  it('passes when there are no units even if upkeep is unpaid', () => {
    const G = baseState();
    G.foreign = {
      hand: [],
      inPlay: [],
      battleDeck: [],
      tradeDeck: [],
      inFlight: { battle: null, committed: [] },
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignTurn'));
    expect(result).toBeUndefined();
    expect(G.othersDone?.['3']).toBe(true);
  });

  it('passes when every unit was recruited this turn (exempt from upkeep)', () => {
    const G = baseState();
    G.foreign = {
      hand: [],
      inPlay: [{ defID: 'Militia', count: 2 }],
      battleDeck: [],
      tradeDeck: [],
      inFlight: { battle: null, committed: [] },
      _recruitedThisTurn: { Militia: 2 },
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignTurn'));
    expect(result).toBeUndefined();
    expect(G.othersDone?.['3']).toBe(true);
  });

  it('rejects when only some units were recruited this turn (others still owe upkeep)', () => {
    const G = baseState();
    G.foreign = {
      hand: [],
      inPlay: [{ defID: 'Militia', count: 3 }],
      battleDeck: [],
      tradeDeck: [],
      inFlight: { battle: null, committed: [] },
      _recruitedThisTurn: { Militia: 1 },
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'foreignTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['3']).toBeUndefined();
  });
});
