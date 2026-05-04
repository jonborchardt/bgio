// Tests for defenseSeatDone (1.4 — defense redesign).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { defenseSeatDone } from '../../../src/game/roles/defense/seatDone.ts';
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
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats: initialMats(roleAssignments),
  };
};

const callSeatDone = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
): typeof INVALID_MOVE | void => {
  const mv = defenseSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('defenseSeatDone (1.4)', () => {
  it('flips G.othersDone[seat] when called from defenseTurn', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const defenseSeat = seatOfRole(assignments, 'defense');

    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    runMoves(client, [{ player: defenseSeat, move: 'defenseSeatDone' }]);
    expect(client.getState()!.G.othersDone?.[defenseSeat]).toBe(true);
  });

  it('out-of-stage call returns INVALID_MOVE', () => {
    const G = baseState();
    const result = callSeatDone(G, '3', ctxAt('3', 'domesticTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['3']).toBeUndefined();
  });

  it('wrong-role seat returns INVALID_MOVE', () => {
    const G = baseState();
    // Seat '2' is domestic in 4p — calling defenseSeatDone from there
    // must reject.
    const result = callSeatDone(G, '2', ctxAt('2', 'defenseTurn'));
    expect(result).toBe(INVALID_MOVE);
  });

  it('passes when called from defenseTurn (no upkeep gate)', () => {
    const G = baseState();
    G.defense = {
      hand: [],
      inPlay: [],
    };
    const result = callSeatDone(G, '3', ctxAt('3', 'defenseTurn'));
    expect(result).toBeUndefined();
    expect(G.othersDone?.['3']).toBe(true);
  });
});
