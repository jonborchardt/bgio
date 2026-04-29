// Tests for foreignSeatDone (14.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignSeatDone } from '../../../src/game/roles/foreign/seatDone.ts';
import { makeClient } from '../../helpers/makeClient.ts';
import { runMoves } from '../../helpers/runMoves.ts';
import { seatOfRole, assignRoles } from '../../../src/game/roles.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import type {
  ResourceBag,
  SettlementState,
} from '../../../src/game/types.ts';

const ctxAt = (seat: string, stage: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: stage },
  }) as unknown as Ctx;

const baseState = (): SettlementState => {
  const roleAssignments = assignRoles(4);
  const wallets: Record<string, ResourceBag> = {};
  const matCircles: Record<string, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      wallets[seat] = bagOf({});
      matCircles[seat] = bagOf({});
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
});
