// Tests for domesticSeatDone (14.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticSeatDone } from '../../../src/game/roles/domestic/seatDone.ts';
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
  const mv = domesticSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('domesticSeatDone (14.2)', () => {
  it('flips G.othersDone[seat] when called from domesticTurn', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const domesticSeat = seatOfRole(assignments, 'domestic');

    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    runMoves(client, [{ player: domesticSeat, move: 'domesticSeatDone' }]);
    expect(client.getState()!.G.othersDone?.[domesticSeat]).toBe(true);
  });

  it('out-of-stage call returns INVALID_MOVE', () => {
    const G = baseState();
    // Seat '2' is the domestic seat in 4p; pointing activePlayers at a
    // different stage trips the gate.
    const result = callSeatDone(G, '2', ctxAt('2', 'scienceTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['2']).toBeUndefined();
  });

  it('wrong-role seat returns INVALID_MOVE', () => {
    const G = baseState();
    // Seat '1' is science in 4p — calling domesticSeatDone from there
    // must reject regardless of the active stage.
    const result = callSeatDone(G, '1', ctxAt('1', 'domesticTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['1']).toBeUndefined();
  });
});
