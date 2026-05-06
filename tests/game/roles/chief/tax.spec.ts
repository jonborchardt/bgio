// Chief Tax super-power — integration tests.
//
// Drives the move through a full headless bgio Client so we exercise:
//   - validation gating (chief role, chiefPhase, latch),
//   - the floor(half) take from each non-chief stash,
//   - the ceil(half_of_take) bank gain + remainder evaporation,
//   - the once-per-round latch and round-end reset,
//   - economyHigh staying in sync via the bank-log helper.

import { describe, expect, it } from 'vitest';
import { makeClient } from '../../../helpers/makeClient.ts';
import { runMoves } from '../../../helpers/runMoves.ts';
import { seatOfRole } from '../../../../src/game/roles.ts';

/**
 * Seed each non-chief seat's stash directly via the Immer-wrapped bgio
 * state. We can't call moves to populate stash (no per-seat mint move
 * exists, on purpose) so tests reach in via the dev-mode "grant all"
 * move and then sculpt from there. Simpler: write the stash directly
 * by driving the same `__devGrantAllRoles` move and then trimming.
 *
 * For tests we lean on `__devGrantAllRoles` to mint baseline stash,
 * then call chiefTax and assert against the post-tax state.
 */

describe('chiefTax (chief super-power)', () => {
  it('takes floor(stash/2) per resource per non-chief seat; bank gains ceil(taken/2)', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-1' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');
    const seats = Object.keys(G0.mats);

    // Mint a baseline of 7 of every resource into every non-chief stash
    // via the dev move. 7 is chosen so floor(7/2) = 3 (taxable) and
    // ceil(3/2) = 2 (bank gain), giving non-trivial evaporation.
    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [7] },
    ]);

    const before = client.getState()!.G;
    // Snapshot stash totals before tax.
    const stashBefore: Record<string, Record<string, number>> = {};
    for (const seat of seats) {
      stashBefore[seat] = { ...before.mats[seat]!.stash };
    }
    const bankBefore = { ...before.bank };

    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);

    const after = client.getState()!.G;

    // Each non-chief stash loses floor(7/2) = 3 of each of the 10 resources.
    for (const seat of seats) {
      for (const r of Object.keys(stashBefore[seat]!)) {
        const had = stashBefore[seat]![r] ?? 0;
        const expected = had - Math.floor(had / 2);
        expect(after.mats[seat]!.stash[r as keyof typeof after.bank]).toBe(
          expected,
        );
      }
    }

    // Bank gains ceil(taken/2). Taken per resource = 3 stashes × 3
    // (since 4 seats but the chief doesn't have a mat) actually let's
    // compute it generically against the recorded `before`.
    const expectedBank = { ...bankBefore };
    for (const r of Object.keys(bankBefore)) {
      let taken = 0;
      for (const seat of seats) {
        const had = stashBefore[seat]![r] ?? 0;
        taken += Math.floor(had / 2);
      }
      expectedBank[r as keyof typeof expectedBank] =
        (expectedBank[r as keyof typeof expectedBank] ?? 0) +
        Math.ceil(taken / 2);
    }
    for (const r of Object.keys(expectedBank)) {
      expect(after.bank[r as keyof typeof after.bank]).toBe(
        expectedBank[r as keyof typeof expectedBank],
      );
    }
  });

  it('uniform 2-each input → bank +2 each, every stash drops to 1', () => {
    // With 2 of each resource per non-chief stash: floor(2/2) = 1 taken
    // per resource per seat. 3 non-chief seats → taken = 3 per resource.
    // ceil(3/2) = 2 to bank, 1 evaporates per resource. The spec's
    // gold/wood/science worked example collapses into the same shape
    // when inputs are uniform.
    const client = makeClient({ numPlayers: 4, seed: 'tax-2' });
    const G0 = client.getState()!.G;
    const roles = G0.roleAssignments;
    const chiefSeat = seatOfRole(roles, 'chief');
    const sciSeat = seatOfRole(roles, 'science');
    const domSeat = seatOfRole(roles, 'domestic');
    const defSeat = seatOfRole(roles, 'defense');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [2] },
    ]);

    const before = client.getState()!.G;
    const bankBefore = { ...before.bank };

    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);

    const after = client.getState()!.G;

    for (const seat of [sciSeat, domSeat, defSeat]) {
      for (const r of Object.keys(after.mats[seat]!.stash)) {
        expect(after.mats[seat]!.stash[r as keyof typeof after.bank]).toBe(1);
      }
    }
    for (const r of Object.keys(bankBefore)) {
      const had = bankBefore[r as keyof typeof bankBefore] ?? 0;
      expect(after.bank[r as keyof typeof after.bank]).toBe(had + 2);
    }
  });

  it('sets the latch on first call; rejects a second tax in the same round', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-3' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
    ]);

    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);
    expect(client.getState()!.G.chief?.taxedThisRound).toBe(true);

    const afterFirst = JSON.parse(JSON.stringify(client.getState()!.G));
    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);
    // INVALID_MOVE leaves G unchanged.
    expect(client.getState()!.G).toEqual(afterFirst);
  });

  it('rejects when called from a non-chief seat', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-4' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
    ]);

    const before = JSON.parse(JSON.stringify(client.getState()!.G));
    // Pick a non-chief seat (always seat '1' in 4p — chief is seat 0).
    runMoves(client, [{ player: '1', move: 'chiefTax' }]);
    // Compare the bank slot — playerView won't redact it, and an
    // unchanged value across an INVALID_MOVE is the contract.
    expect(client.getState()!.G.bank).toEqual(before.bank);
    expect(client.getState()!.G.chief?.taxedThisRound).not.toBe(true);
  });

  it('rejects when called outside chiefPhase', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-5' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
      // Drive into othersPhase so chiefPhase-gated moves should reject.
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
    ]);
    expect(client.getState()!.ctx.phase).toBe('othersPhase');

    const before = JSON.parse(JSON.stringify(client.getState()!.G.bank));
    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);
    expect(client.getState()!.G.bank).toEqual(before);
    expect(client.getState()!.G.chief?.taxedThisRound).not.toBe(true);
  });

  it('round-end hook clears the latch so the next round can tax again', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-6' });
    const G0 = client.getState()!.G;
    const roles = G0.roleAssignments;
    const chiefSeat = seatOfRole(roles, 'chief');
    const sciSeat = seatOfRole(roles, 'science');
    const domSeat = seatOfRole(roles, 'domestic');
    const defSeat = seatOfRole(roles, 'defense');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
      { player: chiefSeat, move: 'chiefTax' },
      { player: chiefSeat, move: 'chiefFlipTrack' },
      { player: chiefSeat, move: 'chiefEndPhase' },
      { player: sciSeat, move: 'scienceSeatDone' },
      { player: domSeat, move: 'domesticSeatDone' },
      { player: defSeat, move: 'defenseSeatDone' },
    ]);

    // We should be back in chiefPhase for round 2 with the latch cleared.
    expect(client.getState()!.ctx.phase).toBe('chiefPhase');
    expect(client.getState()!.G.chief?.taxedThisRound).not.toBe(true);
  });

  it('writes a single bank-log entry sourced "tax" with the bank gain delta', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-7' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
    ]);

    const logBefore = (client.getState()!.G.bankLog ?? []).length;
    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);
    const log = client.getState()!.G.bankLog ?? [];
    expect(log.length).toBe(logBefore + 1);
    const entry = log[log.length - 1]!;
    expect(entry.source).toBe('tax');
    expect(entry.detail).toBe('Chief tax');
    // 4 of each → take 2 per stash × 3 stashes = 6 per resource. Bank
    // gains ceil(6/2) = 3 per resource. Spot-check gold.
    expect(entry.delta.gold).toBe(3);
  });

  it('updates economyHigh when bank.gold rises', () => {
    const client = makeClient({ numPlayers: 4, seed: 'tax-8' });
    const G0 = client.getState()!.G;
    const chiefSeat = seatOfRole(G0.roleAssignments, 'chief');

    runMoves(client, [
      { player: chiefSeat, move: '__devGrantAllRoles', args: [4] },
    ]);

    const before = client.getState()!.G;
    const econBefore = before.economyHigh ?? 0;
    runMoves(client, [{ player: chiefSeat, move: 'chiefTax' }]);
    const after = client.getState()!.G;
    expect(after.bank.gold).toBeGreaterThan(before.bank.gold);
    expect(after.economyHigh ?? 0).toBeGreaterThanOrEqual(after.bank.gold);
    expect(after.economyHigh ?? 0).toBeGreaterThan(econBefore);
  });
});
