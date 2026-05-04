// Defense redesign 2.4 — round shape integration tests.
//
// Sub-phase 2.4 wires the **chief → flip/resolve → others mitigate**
// round shape (spec D22 + §6) into bgio's phase machinery. This file
// exercises the round shape end-to-end against a headless client:
//
//   - chiefPhase requires a `chiefFlipTrack` before `chiefEndPhase`
//     succeeds (the flip is the table-presence beat).
//   - othersPhase only begins after `flippedThisRound` is `true`.
//   - `chiefFlipTrack` is rejected after the chief has exited the
//     phase (engine has moved on to `othersPhase`).
//   - The round-end hook in `track.ts` clears `flippedThisRound` so
//     the next round's chief is forced to flip again.
//   - Determinism: two seeded runs produce identical track histories.
//
// We drive the parallel `othersPhase` via the per-role seat-done moves
// so the engine cycles cleanly back to `chiefPhase` after each round.

import { describe, expect, it } from 'vitest';
import { makeClient } from '../../helpers/makeClient.ts';
import { runMoves } from '../../helpers/runMoves.ts';
import { seatOfRole } from '../../../src/game/roles.ts';

describe('round shape (defense redesign 2.4)', () => {
  it('chief phase: flip then end transitions cleanly to othersPhase', () => {
    const client = makeClient({ numPlayers: 4, seed: 'round-1' });
    const a = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(a, 'chief');

    // Pre-flip the latch is unset and the engine is in chiefPhase.
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    expect(client.getState()!.G.track!.flippedThisRound).not.toBe(true);

    // Flip the track first; chiefEndPhase succeeds afterward.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);

    const after = client.getState()!;
    expect(after.ctx.phase).toBe('othersPhase');
    expect(after.G.track!.flippedThisRound).toBe(true);
  });

  it('chiefEndPhase is rejected when flippedThisRound is false', () => {
    const client = makeClient({ numPlayers: 4, seed: 'round-2' });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    // Without flipping first, chiefEndPhase is a no-op-rejection: the
    // engine stays in chiefPhase.
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    expect(client.getState()!.G.phaseDone).not.toBe(true);
  });

  it('chiefFlipTrack is rejected after the chief has exited chiefPhase', () => {
    const client = makeClient({ numPlayers: 4, seed: 'round-3' });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );

    // Drive a full chief→others transition.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    // Snapshot the track and try to flip again. INVALID_MOVE leaves
    // the track unchanged.
    const trackBefore = JSON.parse(
      JSON.stringify(client.getState()!.G.track),
    );
    runMoves(client, [{ player: chiefSeat, move: 'chiefFlipTrack' }]);
    expect(client.getState()!.G.track).toEqual(trackBefore);
  });

  it('multi-round: round-end hook clears flippedThisRound; next round requires another flip', () => {
    const client = makeClient({ numPlayers: 4, seed: 'round-4' });
    const a = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(a, 'chief');
    const sci = seatOfRole(a, 'science');
    const dom = seatOfRole(a, 'domestic');
    const def = seatOfRole(a, 'defense');

    // Round 0: chief flips + ends, others all done → endOfRound runs
    // hooks (which clears the latch) → engine cycles back to chiefPhase
    // for round 1.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
      { player: sci, move: 'scienceSeatDone' },
      { player: dom, move: 'domesticSeatDone' },
      { player: def, move: 'defenseSeatDone' },
    ]);

    // We've cycled back to chiefPhase for the next round, and the
    // latch has been reset.
    const cycled = client.getState()!;
    expect(cycled.ctx.phase).toBe('chiefPhase');
    expect(cycled.G.round).toBe(1);
    expect(cycled.G.track!.flippedThisRound).not.toBe(true);

    // chiefEndPhase is rejected again (force the chief to flip first).
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');

    // Flip + end advances cleanly into othersPhase for round 1.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');
    expect(client.getState()!.G.track!.flippedThisRound).toBe(true);
  });

  it('determinism: two seeded runs produce identical track histories across multiple rounds', () => {
    const drive = (): string[] => {
      const client = makeClient({ numPlayers: 4, seed: 'det-round' });
      const a = client.getState()!.G.roleAssignments;
      const chiefSeat = seatOfRole(a, 'chief');
      const sci = seatOfRole(a, 'science');
      const dom = seatOfRole(a, 'domestic');
      const def = seatOfRole(a, 'defense');
      for (let r = 0; r < 4; r += 1) {
        runMoves(client, [
          { player: chiefSeat, move: 'chiefFlipTrack' },
          { player: chiefSeat, move: 'chiefEndPhase' },
          { player: sci, move: 'scienceSeatDone' },
          { player: dom, move: 'domesticSeatDone' },
          { player: def, move: 'defenseSeatDone' },
        ]);
      }
      return client.getState()!.G.track!.history.map((c) => c.id);
    };
    const a = drive();
    const b = drive();
    expect(a).toEqual(b);
    // 4 rounds → 4 cards flipped.
    expect(a.length).toBe(4);
  });

  it('history grows by exactly 1 per round; flippedThisRound matches phase position', () => {
    const client = makeClient({ numPlayers: 4, seed: 'round-grow' });
    const a = client.getState()!.G.roleAssignments;
    const chiefSeat = seatOfRole(a, 'chief');
    const sci = seatOfRole(a, 'science');
    const dom = seatOfRole(a, 'domestic');
    const def = seatOfRole(a, 'defense');

    expect(client.getState()!.G.track!.history).toEqual([]);

    for (let r = 0; r < 3; r += 1) {
      // Pre-flip: latch should be cleared each round.
      expect(client.getState()!.G.track!.flippedThisRound).not.toBe(true);
      expect(client.getState()!.G.track!.history.length).toBe(r);

      runMoves(client, [
        { player: chiefSeat, move: 'chiefFlipTrack' },
      ]);
      // Post-flip but pre-endPhase: latch is set.
      expect(client.getState()!.G.track!.flippedThisRound).toBe(true);
      expect(client.getState()!.G.track!.history.length).toBe(r + 1);

      runMoves(client, [
        { player: chiefSeat, move: 'chiefEndPhase' },
        { player: sci, move: 'scienceSeatDone' },
        { player: dom, move: 'domesticSeatDone' },
        { player: def, move: 'defenseSeatDone' },
      ]);
      // After endOfRound has cycled back: latch cleared by the
      // round-end hook (and also by chiefPhase.onBegin).
      expect(client.getState()!.G.round).toBe(r + 1);
    }

    expect(client.getState()!.G.track!.history.length).toBe(3);
  });
});
