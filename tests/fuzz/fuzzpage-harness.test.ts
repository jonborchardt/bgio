// Mirrors `src/fuzz/FuzzPage.tsx`'s composed-bot harness so a regression
// in any seat's bot or fallback shows up in unit-test land instead of
// only in the slow Playwright smoke spec. The real e2e (smoke.spec.ts)
// still runs end-to-end through the browser, but this test covers the
// engine-level loop without webdriver overhead.

import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import type { Ctx } from 'boardgame.io';
import { Settlement } from '../../src/game/index.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { rolesAtSeat } from '../../src/game/roles.ts';
import { chiefBot } from '../../src/game/ai/chiefBot.ts';
import { domesticBot } from '../../src/game/ai/domesticBot.ts';
import { defenseBot } from '../../src/game/ai/defenseBot.ts';
import { scienceBot } from '../../src/game/ai/scienceBot.ts';

const MAX_MOVES = 8000;
const STUCK_LIMIT = 200;
const FUZZ_TURN_CAP = 20;

const ROLE_BOTS = {
  chief: chiefBot,
  science: scienceBot,
  domestic: domesticBot,
  defense: defenseBot,
} as const;

const pickNextMove = (
  G: SettlementState,
  ctx: Ctx,
): { playerID: string; move: string; args: unknown[] } | null => {
  const activeSeats = ctx.activePlayers
    ? Object.keys(ctx.activePlayers)
    : [ctx.currentPlayer];
  const filteredSeats = activeSeats.filter(
    (seat) => G.othersDone?.[seat] !== true,
  );
  for (const seat of filteredSeats) {
    const roles = rolesAtSeat(G.roleAssignments, seat);
    for (const role of roles) {
      const bot = ROLE_BOTS[role];
      try {
        const action = bot.play({ G, ctx, playerID: seat });
        if (action !== null) {
          return { playerID: seat, move: action.move, args: action.args };
        }
      } catch {
        // continue
      }
    }
  }
  for (const seat of filteredSeats) {
    const stage = ctx.activePlayers?.[seat];
    const roles = rolesAtSeat(G.roleAssignments, seat);
    if (roles.includes('chief') && ctx.phase === 'chiefPhase') {
      if (
        G.track !== undefined &&
        G.track.flippedThisRound !== true &&
        G.track.upcoming.length > 0
      ) {
        return { playerID: seat, move: 'chiefFlipTrack', args: [] };
      }
      return { playerID: seat, move: 'chiefEndPhase', args: [] };
    }
    if (stage === 'scienceTurn' && roles.includes('science')) {
      return { playerID: seat, move: 'scienceSeatDone', args: [] };
    }
    if (stage === 'domesticTurn' && roles.includes('domestic')) {
      return { playerID: seat, move: 'domesticSeatDone', args: [] };
    }
    if (stage === 'defenseTurn' && roles.includes('defense')) {
      return { playerID: seat, move: 'defenseSeatDone', args: [] };
    }
  }
  return null;
};

describe('fuzz-page composed bot drives a 4p match to a terminal outcome', () => {
  it('reaches gameover (win | timeUp) before the stuck/MAX guards trip', () => {
    const seed = 'e2e-smoke-1';
    const baseSetup = Settlement.setup;
    const wrappedSetup = (
      ctx: Parameters<NonNullable<typeof baseSetup>>[0],
      ...rest: unknown[]
    ): SettlementState => {
      const setupFn = baseSetup as unknown as (
        ctx: unknown,
        ...rest: unknown[]
      ) => SettlementState;
      const G = setupFn(ctx, ...rest);
      G.turnCap = FUZZ_TURN_CAP;
      return G;
    };
    const seededGame = {
      ...Settlement,
      seed,
      setup: wrappedSetup,
    } as typeof Settlement;
    const client = Client<SettlementState>({
      game: seededGame,
      numPlayers: 4,
    });
    client.start();

    let movesRun = 0;
    let lastRound = -1;
    let stuckCount = 0;
    let outcome: 'win' | 'timeUp' | 'cap' | 'noMove' = 'cap';

    while (movesRun < MAX_MOVES) {
      const state = client.getState();
      if (state === null) break;
      if (state.ctx.gameover !== undefined) {
        const gv = state.ctx.gameover as { kind?: string };
        outcome = gv.kind === 'win' ? 'win' : 'timeUp';
        break;
      }
      if (state.G.round !== lastRound) {
        lastRound = state.G.round;
        stuckCount = 0;
      } else {
        stuckCount += 1;
        if (stuckCount > STUCK_LIMIT) {
          outcome = 'cap';
          break;
        }
      }
      const next = pickNextMove(state.G, state.ctx);
      if (next === null) {
        outcome = 'noMove';
        break;
      }
      const moves = client.moves as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      const fn = moves[next.move];
      if (typeof fn !== 'function') break;
      client.updatePlayerID(next.playerID);
      try {
        fn(...next.args);
      } catch {
        // INVALID_MOVE returns are normal; engine throws are caught.
      }
      movesRun += 1;
    }

    expect(['win', 'timeUp']).toContain(outcome);
    expect(client.getState()?.G.round).toBeGreaterThan(0);
  }, 60_000);
});
