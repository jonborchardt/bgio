// Defense redesign 2.3 — `chiefFlipTrack` move integration tests.
//
// These run through a full headless bgio Client so we exercise:
//   - the move's gating (only chief seat, only in chiefPhase, only when
//     `upcoming` has a card, only once per round),
//   - the side effect on `G.track` (advance, set `flippedThisRound`),
//   - the integration with `chiefEndPhase` (rejection until flip).

import { describe, expect, it } from 'vitest';
import { makeClient } from '../../../helpers/makeClient.ts';
import { runMoves } from '../../../helpers/runMoves.ts';
import { seatOfRole } from '../../../../src/game/roles.ts';

describe('chiefFlipTrack (defense redesign 2.3)', () => {
  it('flips a non-empty track: history grows by 1, latch flips to true', () => {
    const client = makeClient({ numPlayers: 4, seed: 'flip-1' });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );
    const before = client.getState()!.G;
    expect(before.track).toBeDefined();
    expect(before.track!.flippedThisRound).not.toBe(true);
    const upcomingBefore = before.track!.upcoming.length;

    runMoves(client, [{ player: chiefSeat, move: 'chiefFlipTrack' }]);

    const after = client.getState()!.G;
    expect(after.track!.upcoming.length).toBe(upcomingBefore - 1);
    expect(after.track!.history.length).toBe(1);
    expect(after.track!.flippedThisRound).toBe(true);
  });

  it('rejects a second flip in the same round (latch already set)', () => {
    const client = makeClient({ numPlayers: 4, seed: 'flip-2' });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );
    runMoves(client, [{ player: chiefSeat, move: 'chiefFlipTrack' }]);
    const afterFirst = JSON.parse(JSON.stringify(client.getState()!.G));
    runMoves(client, [{ player: chiefSeat, move: 'chiefFlipTrack' }]);
    // INVALID_MOVE leaves G unchanged.
    expect(client.getState()!.G).toEqual(afterFirst);
  });

  it('rejects when called from a non-chief seat', () => {
    const client = makeClient({ numPlayers: 4, seed: 'flip-3' });
    // Drive the rejected call from seat '1' (science in 4p) and
    // confirm the track was not advanced — comparing the track slot
    // sidesteps player-view redaction differences across runMoves
    // playerID switches.
    const trackBefore = JSON.parse(
      JSON.stringify(client.getState()!.G.track),
    );
    runMoves(client, [{ player: '1', move: 'chiefFlipTrack' }]);
    expect(client.getState()!.G.track).toEqual(trackBefore);
    expect(client.getState()!.G.track!.flippedThisRound).not.toBe(true);
  });

  it('chiefEndPhase rejects until chiefFlipTrack has fired', () => {
    const client = makeClient({ numPlayers: 4, seed: 'flip-4' });
    const chiefSeat = seatOfRole(
      client.getState()!.G.roleAssignments,
      'chief',
    );
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');

    // Unflipped: chiefEndPhase is a no-op.
    runMoves(client, [{ player: chiefSeat, move: 'chiefEndPhase' }]);
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');

    // After flip, chiefEndPhase succeeds.
    runMoves(client, [
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');
  });

  it('determinism: two clients with the same seed flip the same first card', () => {
    const a = makeClient({ numPlayers: 4, seed: 'det-seed' });
    const b = makeClient({ numPlayers: 4, seed: 'det-seed' });
    const aChief = seatOfRole(a.getState()!.G.roleAssignments, 'chief');
    const bChief = seatOfRole(b.getState()!.G.roleAssignments, 'chief');
    runMoves(a, [{ player: aChief, move: 'chiefFlipTrack' }]);
    runMoves(b, [{ player: bChief, move: 'chiefFlipTrack' }]);
    const aFlipped = a.getState()!.G.track!.history[0]!;
    const bFlipped = b.getState()!.G.track!.history[0]!;
    expect(aFlipped.id).toBe(bFlipped.id);
  });

  it('flipping 5 threats sequentially produces stable bankLog/state across two seeded runs', () => {
    // Drives 5 rounds of "chief flip → chief end" against the same seed.
    // Since the engine reaches othersPhase after end-phase, we drive
    // each seat's seatDone to loop back to chiefPhase, so the next round
    // can flip again. This is the spec D8 determinism contract.
    const drive = (): unknown => {
      const client = makeClient({ numPlayers: 4, seed: 'det-5' });
      const a = client.getState()!.G.roleAssignments;
      const chiefSeat = seatOfRole(a, 'chief');
      const sci = seatOfRole(a, 'science');
      const dom = seatOfRole(a, 'domestic');
      const def = seatOfRole(a, 'defense');
      for (let r = 0; r < 5; r += 1) {
        runMoves(client, [
          { player: chiefSeat, move: 'chiefFlipTrack' },
          { player: chiefSeat, move: 'chiefEndPhase' },
        ]);
        runMoves(client, [
          { player: sci, move: 'scienceSeatDone' },
          { player: dom, move: 'domesticSeatDone' },
          { player: def, move: 'defenseSeatDone' },
        ]);
      }
      const G = client.getState()!.G;
      // Snapshot just the deterministic bits we care about for this
      // contract: the track's history ids and the bank log.
      return {
        history: G.track!.history.map((c) => c.id),
        bankLog: G.bankLog,
      };
    };
    const a = drive();
    const b = drive();
    expect(a).toEqual(b);
  });
});
