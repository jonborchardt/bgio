// Tests for chiefEndPhase (04.2).
//
// Driven through a headless client because the move's whole point is to
// trigger bgio's phase transition + activePlayers re-wiring. The same
// test-helper utilities used by tests/phases.test.ts are reused here.

import { describe, expect, it } from 'vitest';
import { makeClient } from '../../helpers/makeClient.ts';
import { runMoves } from '../../helpers/runMoves.ts';
import { seatOfRole } from '../../../src/game/roles.ts';
import { STAGES } from '../../../src/game/phases/stages.ts';

describe('chiefEndPhase (04.2)', () => {
  it('calling chiefEndPhase lands the game in othersPhase', () => {
    const client = makeClient();
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');
    expect(client.getState()!.G.phaseDone).toBe(true);
  });

  it('active players in othersPhase: every non-chief seat in expected stage; chief seat in done', () => {
    const client = makeClient({ numPlayers: 4 });
    const assignments = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(assignments, 'chief');

    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    const active = client.getState()!.ctx.activePlayers ?? {};

    // 4-player game: seat 0 chief, seat 1 science, seat 2 domestic, seat 3 foreign.
    expect(active[chiefSeat]).toBe(STAGES.done);
    expect(active['1']).toBe(STAGES.scienceTurn);
    expect(active['2']).toBe(STAGES.domesticTurn);
    expect(active['3']).toBe(STAGES.foreignTurn);
  });

  it('calling chiefEndPhase outside chiefPhase returns INVALID_MOVE', () => {
    const client = makeClient();
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    // Get out of chiefPhase first by using the real chiefEndPhase.
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    // Snapshot G; the rejected move must not mutate it.
    const beforeG = JSON.parse(JSON.stringify(client.getState()!.G));

    // Calling again from othersPhase: bgio rejects INVALID_MOVE silently;
    // we observe the state is untouched and the phase has not advanced.
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');
    expect(client.getState()!.G).toEqual(beforeG);
  });

  it('calling twice in chiefPhase is a no-op (the second call just sets phaseDone=true again, transition already happened)', () => {
    const client = makeClient();
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    runMoves(client, [
      { player: chiefSeat, move: 'chiefEndPhase' },
      // Second call lands in othersPhase (the transition already happened
      // after the first call). bgio's `ctx.phase` check inside the move
      // returns INVALID_MOVE, so this is effectively a no-op — we only
      // care that the engine remains in a valid post-transition state.
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);

    expect(client.getState()!.ctx.phase).toBe('othersPhase');
    expect(client.getState()!.G.phaseDone).toBe(true);
  });
});
