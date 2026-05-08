// Reproduces the bot driver's tick-loop interaction with scienceBot:
//   - call scienceBot.play() to get a move candidate
//   - apply the move directly against G (simulating Master.onUpdate)
//   - re-call scienceBot.play()
//
// If the bot only emits scienceLibraryBurn ONCE per round and then
// emits scienceSeatDone, the log on the live deploy shouldn't show
// multi-burns. If this test reproduces multi-burns, my fix doesn't
// actually work and I need to dig deeper.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { scienceBot } from '../../src/game/ai/scienceBot.ts';
import { scienceLibraryBurn } from '../../src/game/roles/science/libraryBurn.ts';
import { requestHelp } from '../../src/game/requests/move.ts';
import { setup } from '../../src/game/setup.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { seatOfRole } from '../../src/game/roles.ts';
import { RESOURCES } from '../../src/game/resources/types.ts';
import type { RequestHelpPayload } from '../../src/game/requests/move.ts';

const setupG = (numPlayers: number): SettlementState =>
  setup(
    {
      ctx: { numPlayers },
      random: { Shuffle: <T>(a: T[]) => a, D6: () => 1 },
    } as unknown as Parameters<typeof setup>[0],
    {} as Parameters<typeof setup>[1],
  );

const ctxFor = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    numPlayers: 4,
    currentPlayer: seat,
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const applyMove = (
  move: { move: string; args: unknown[] },
  G: SettlementState,
  seat: string,
  ctx: Ctx,
): void => {
  if (move.move === 'scienceLibraryBurn') {
    const slot = move.args[0] as number;
    // Call the move function directly. Mirrors what bgio's Master does
    // post-Immer (we don't get the wrapping but for our state-mutation
    // test the direct call is enough).
    const fn = scienceLibraryBurn as unknown as (
      args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
      slot: number,
    ) => unknown;
    fn({ G, ctx, playerID: seat }, slot);
  } else if (move.move === 'requestHelp') {
    const payload = move.args[0] as RequestHelpPayload;
    const fn = requestHelp as unknown as (
      args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
      p: RequestHelpPayload,
    ) => unknown;
    fn({ G, ctx, playerID: seat }, payload);
  } else if (move.move === 'scienceSeatDone') {
    // Don't actually apply — we just want to know the bot stopped
    // burning. seatDone is the terminal signal.
  } else {
    throw new Error(`unexpected move: ${move.move}`);
  }
};

describe('scienceBot full-loop simulation', () => {
  it('after one burn (mutating G), the next call returns scienceSeatDone', () => {
    const G = setupG(4);
    const seat = seatOfRole(G.roleAssignments, 'science');
    // Drain the seat's stash + bank so nothing in the library is
    // affordable. Forces the bot down the burn path.
    if (G.mats[seat]) {
      for (const r of RESOURCES) G.mats[seat]!.stash[r] = 0;
    }
    for (const r of RESOURCES) G.bank[r] = 0;

    const ctx = ctxFor(seat);

    // Simulate the bot driver's tick: call → apply → call → apply ...
    // Track every move the bot picks.
    const movesPlayed: string[] = [];
    for (let tick = 0; tick < 10; tick++) {
      const action = scienceBot.play({ G, ctx, playerID: seat });
      if (action === null) {
        movesPlayed.push('null');
        break;
      }
      movesPlayed.push(action.move);
      applyMove(action, G, seat, ctx);
      if (action.move === 'scienceSeatDone') break;
    }

    // Expected sequence: one requestHelp (so chief sees what the bot's
    // trying to buy), then one burn, then seatDone.
    // Bug sequence (the live one before the loop fix): burn, burn,
    // burn, ..., (eventually seatDone after row drains).
    expect(movesPlayed[0]).toBe('requestHelp');
    expect(movesPlayed[1]).toBe('scienceLibraryBurn');
    expect(movesPlayed[2]).toBe('scienceSeatDone');
    expect(movesPlayed.length).toBe(3);
  });

  it('verifies scienceBurnedThisRound is set true after the burn move runs', () => {
    const G = setupG(4);
    const seat = seatOfRole(G.roleAssignments, 'science');
    if (G.mats[seat]) {
      for (const r of RESOURCES) G.mats[seat]!.stash[r] = 0;
    }
    for (const r of RESOURCES) G.bank[r] = 0;
    const ctx = ctxFor(seat);

    expect(G.science?.scienceBurnedThisRound).not.toBe(true);
    // First call is the help request (so the chief sees the ask);
    // apply it so the dedupe path frees the bot to move on.
    const ask = scienceBot.play({ G, ctx, playerID: seat });
    expect(ask?.move).toBe('requestHelp');
    applyMove(ask!, G, seat, ctx);
    const action = scienceBot.play({ G, ctx, playerID: seat });
    expect(action?.move).toBe('scienceLibraryBurn');
    applyMove(action!, G, seat, ctx);
    // The burn move itself sets the latch.
    expect(G.science?.scienceBurnedThisRound).toBe(true);
  });
});
