// Tests for scienceSeatDone (14.2).
//
// Driven through a headless client because the move's whole point is to
// advance bgio's phase machinery once every non-chief seat has flipped
// done. Out-of-stage and wrong-role rejections are exercised via direct
// move calls against a hand-built (G, ctx) so the assertions are local.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceSeatDone } from '../../../src/game/roles/science/seatDone.ts';
import { makeClient } from '../../helpers/makeClient.ts';
import { runMoves } from '../../helpers/runMoves.ts';
import { seatOfRole, assignRoles } from '../../../src/game/roles.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const ctxAt = (
  seat: string,
  stage: string,
  phase: string = 'othersPhase',
): Ctx =>
  ({
    phase,
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
  const mv = scienceSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('scienceSeatDone (14.2)', () => {
  it('flips G.othersDone[seat]; with all non-chief seats done bgio advances to chiefPhase next round', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const scienceSeat = seatOfRole(assignments, 'science');
    const domesticSeat = seatOfRole(assignments, 'domestic');
    const defenseSeat = seatOfRole(assignments, 'defense');

    // Get out of chiefPhase first (flip + end-phase per D22).
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    // Science seat must burn at least one card per the post-fix rule
    // before flipping done. Slot 0 is always populated in fresh setup.
    runMoves(client, [
      { player: scienceSeat, move: 'scienceLibraryBurn', args: [0] },
      { player: scienceSeat, move: 'scienceSeatDone' },
    ]);
    expect(client.getState()!.G.othersDone?.[scienceSeat]).toBe(true);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    // Now domestic + defense — phase should transition through endOfRound
    // back to chiefPhase once the last seat flips.
    runMoves(client, [{ player: domesticSeat, move: 'domesticSeatDone' }]);
    runMoves(client, [{ player: defenseSeat, move: 'defenseSeatDone' }]);
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
  });

  it('out-of-stage call returns INVALID_MOVE and does not flip the flag', () => {
    const G = baseState();
    // Science seat in 4p is '1', but we deliberately point activePlayers at
    // a different stage so the gate trips.
    const result = callSeatDone(G, '1', ctxAt('1', 'domesticTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['1']).toBeUndefined();
  });

  it('wrong-role seat returns INVALID_MOVE', () => {
    const G = baseState();
    // Seat '2' is the domestic seat in 4p; calling scienceSeatDone from
    // there must reject even when the (mis-routed) stage matches.
    const result = callSeatDone(G, '2', ctxAt('2', 'scienceTurn'));
    expect(result).toBe(INVALID_MOVE);
    expect(G.othersDone?.['2']).toBeUndefined();
  });

  it('no-seat (spectator) call returns INVALID_MOVE', () => {
    const G = baseState();
    const result = callSeatDone(G, undefined, ctxAt('1', 'scienceTurn'));
    expect(result).toBe(INVALID_MOVE);
  });

  // SL fix-5 gap #6 — refill is gated on G.library presence. Older /
  // minimal fixtures may dispatch scienceSeatDone against a state that
  // never seeded G.library; the move must not crash and the existing
  // seat-done end-of-turn behavior (othersDone flag) must still fire.
  it('with G.library absent, does not crash and still flips othersDone[seat]', () => {
    const G = baseState();
    // baseState() returns a state without G.library — mirroring legacy
    // fixtures that pre-date SL 2.2.
    expect(G.library).toBeUndefined();

    // 4-player layout: seat '1' holds the science role.
    const result = callSeatDone(G, '1', ctxAt('1', 'scienceTurn'));

    expect(result).not.toBe(INVALID_MOVE);
    expect(G.othersDone?.['1']).toBe(true);
    // The library slot stays absent — the guard short-circuits the
    // refill helper rather than synthesizing one on demand.
    expect(G.library).toBeUndefined();
  });
});
