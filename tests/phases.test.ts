// Phase-skeleton tests for 02.1.
//
// These tests drive the three-phase loop (chiefPhase -> othersPhase ->
// endOfRound -> chiefPhase) using the temporary `__testSet*Done` moves.
// The test-only moves disappear once 04.2 ships the real chief/others
// "I'm done" moves; the assertions about phase order should keep working.

import { describe, expect, it } from 'vitest';
import { makeClient } from './helpers/makeClient.ts';
import { runMoves } from './helpers/runMoves.ts';
import { seatOfRole } from '../src/game/roles.ts';

describe('phase skeleton (02.1)', () => {
  it('a fresh client lands in chiefPhase', () => {
    const client = makeClient();
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
  });

  it("flipping the chief's phaseDone advances to othersPhase", () => {
    const client = makeClient();
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);
    // bgio re-evaluates `endIf` after the move resolves and advances.
    expect(client.getState()!.ctx.phase).toBe('othersPhase');
  });

  it('setting all non-chief done flags advances othersPhase -> endOfRound -> chiefPhase', () => {
    const client = makeClient();
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const others = Object.keys(assignments).filter((s) => s !== chiefSeat);

    // Get out of chiefPhase first.
    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    // Mark every non-chief seat done. The phase ends only after the last
    // flag is set; intermediate flips leave us in othersPhase.
    for (let i = 0; i < others.length; i++) {
      const seat = others[i]!;
      runMoves(client, [
        { player: seat, move: '__testSetOthersDone', args: [seat] },
      ]);
      const expected =
        i === others.length - 1 ? 'chiefPhase' : 'othersPhase';
      // endOfRound runs onBegin/onEnd synchronously and bgio immediately
      // moves on to its `next`, so we never observe phase==='endOfRound'.
      expect(client.getState()!.ctx.phase).toBe(expected);
    }
  });

  it('a full round cycle returns to chiefPhase with G.round + 1', () => {
    const client = makeClient();
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');
    const others = Object.keys(assignments).filter((s) => s !== chiefSeat);

    const startRound = client.getState()!.G.round;

    // Drive one complete loop.
    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);
    for (const seat of others) {
      runMoves(client, [
        { player: seat, move: '__testSetOthersDone', args: [seat] },
      ]);
    }

    const after = client.getState()!;
    expect(after.ctx.phase).toBe('chiefPhase');
    expect(after.G.round).toBe(startRound + 1);
    // endOfRound resets the per-phase progress flags before handing back.
    expect(after.G.phaseDone).toBe(false);
    expect(after.G.othersDone).toEqual({});
  });
});
