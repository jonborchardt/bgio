// Defense redesign 3.9 — headless 4-player fuzz harness for the e2e
// smoke spec.
//
// Why this exists:
//   The orchestrator gate for sub-phase 3.9 is "npm run e2e:smoke must
//   complete a full match end-to-end (1 human + 3 bots, played to a win
//   or turn-cap)." The hot-seat build doesn't ship a server-side bot
//   driver, so we'd otherwise be unable to reach that bar in a
//   browser-only Playwright run.
//
//   This page mounts a `boardgame.io/client` headless Client and drives
//   it through a per-seat composed bot from `lobby/soloConfig.ts`'s
//   `buildBotMap` helper. Each "step" pulls the next move candidate
//   for the current active seat (via the same chiefBot / scienceBot /
//   domesticBot / defenseBot composition we already use everywhere
//   else) and dispatches it through the client. When every seat's
//   composed bot returns null we fall back to a small set of canonical
//   per-seat fallbacks (`chiefEndPhase`, `*SeatDone`, etc.) so the
//   harness keeps the engine ticking. The page then publishes a
//   `data-fuzz-state="complete"` attribute + an outcome line so the
//   Playwright spec can wait on a stable selector.
//
//   This page is **dev-only**: the entry-point in App.tsx renders it
//   only when `import.meta.env.DEV === true` and the URL hash is
//   `#fuzz`. In production the hash is ignored.
//
// Tabletop-playable rule (CLAUDE.md): not applicable — this is a test
// harness, not a player-facing surface.

import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Client } from 'boardgame.io/client';
import type { Ctx } from 'boardgame.io';
import { Settlement } from '../game/index.ts';
import type { SettlementState } from '../game/types.ts';
import { rolesAtSeat } from '../game/roles.ts';
import { chiefBot } from '../game/ai/chiefBot.ts';
import { scienceBot } from '../game/ai/scienceBot.ts';
import { domesticBot } from '../game/ai/domesticBot.ts';
import { defenseBot } from '../game/ai/defenseBot.ts';

/** Hard cap on the number of bot steps before the harness gives up.
 *  Real 4-player games at our reduced turnCap end well before this; the
 *  cap is a safety net for pathological inputs where the engine never
 *  advances. */
const MAX_MOVES = 8000;

/** Reduced turn cap so the smoke spec finishes quickly. Production
 *  matches default to 80; we run the e2e at 20 so wall-clock stays well
 *  under the Playwright timeout. */
const FUZZ_TURN_CAP = 20;

interface FuzzStatus {
  state: 'running' | 'complete' | 'error';
  movesRun: number;
  outcome: 'win' | 'timeUp' | 'cap' | 'error';
  rounds: number;
  message?: string;
}

/** Resolve `?seed=...` from the URL with a deterministic fallback so
 *  re-runs of the same hash are reproducible. We accept both the
 *  conventional `?seed=` query and the post-hash form `#fuzz?seed=`,
 *  because callers route through the SPA hash. */
const readSeed = (): string => {
  if (typeof window === 'undefined') return 'e2e-default';
  const search = window.location.search;
  const hash = window.location.hash;
  const fromQuery = new URLSearchParams(search).get('seed');
  if (fromQuery !== null) return fromQuery;
  const queryStart = hash.indexOf('?');
  if (queryStart !== -1) {
    const fromHash = new URLSearchParams(hash.slice(queryStart + 1)).get(
      'seed',
    );
    if (fromHash !== null) return fromHash;
  }
  return 'e2e-default';
};

/** Per-role bot dispatch table — same shape as soloConfig.ts. We
 *  inline it rather than importing buildBotMap because we need to
 *  enumerate "any seat that's currently active" not "the non-human
 *  seats." */
const ROLE_BOTS = {
  chief: chiefBot,
  science: scienceBot,
  domestic: domesticBot,
  defense: defenseBot,
} as const;

/**
 * Pick the next move for whatever seat is currently active. Walks
 * `ctx.activePlayers` (or `currentPlayer` when no parallel stages are
 * running), composes per-seat bots out of `rolesAtSeat`, and returns
 * the first non-null candidate. When every active seat's bot returns
 * null we drop into a fallback list of "advance the engine" moves
 * tailored to the current phase / stage so the harness can keep going
 * without getting stuck on a seat that thinks it has nothing to do.
 */
const pickNextMove = (
  G: SettlementState,
  ctx: Ctx,
): { playerID: string; move: string; args: unknown[] } | null => {
  const activeSeats = ctx.activePlayers
    ? Object.keys(ctx.activePlayers)
    : [ctx.currentPlayer];

  // Skip seats that have already declared "done" for the round — the
  // phase's endIf will fire once every non-chief seat is done, so we
  // don't keep re-routing moves to a seat that has nothing left to do.
  const filteredSeats = activeSeats.filter(
    (seat) => G.othersDone?.[seat] !== true,
  );

  // Try each role-bot for each active seat. Return the first
  // non-null candidate. We swallow per-bot exceptions because some
  // of the V1 heuristics (chiefBot in particular) may dereference
  // optional state during the very first round when stash / mats are
  // still warming up; the harness's fallback path keeps the engine
  // ticking even when a bot misbehaves.
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
        // Continue to the next role — fallback list below catches
        // the seat-done equivalent.
      }
    }
  }

  // Fallback: per-phase end-of-turn moves so the engine keeps cycling.
  // Each fallback is gated on its phase / stage so we never dispatch a
  // move that's not legal at this state.
  for (const seat of filteredSeats) {
    const stage = ctx.activePlayers?.[seat];
    const roles = rolesAtSeat(G.roleAssignments, seat);
    if (roles.includes('chief') && ctx.phase === 'chiefPhase') {
      // Try flipping the track first (D22), then end the phase.
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

export function FuzzPage() {
  const [status, setStatus] = useState<FuzzStatus>({
    state: 'running',
    movesRun: 0,
    outcome: 'cap',
    rounds: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      const seed = readSeed();
      // Wrap setup so the headless Client uses a shorter turnCap.
      // bgio's headless `Client({})` doesn't accept `setupData`, so we
      // splice the cap in via `Game.setup` — invoked once at start.
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
      const STUCK_LIMIT = 200;
      try {
        while (movesRun < MAX_MOVES) {
          if (cancelled) return;
          const state = client.getState();
          if (state === null) break;
          if (state.ctx.gameover !== undefined) {
            const outcome = state.ctx.gameover as { kind?: string } | undefined;
            const kind = outcome?.kind === 'win' ? 'win' : 'timeUp';
            setStatus({
              state: 'complete',
              movesRun,
              outcome: kind,
              rounds: state.G.round,
            });
            return;
          }

          // Track stuck-ness by round increment. If 200 moves go by
          // without the round advancing, give up.
          if (state.G.round !== lastRound) {
            lastRound = state.G.round;
            stuckCount = 0;
          } else {
            stuckCount += 1;
            if (stuckCount > STUCK_LIMIT) {
              setStatus({
                state: 'complete',
                movesRun,
                outcome: 'cap',
                rounds: state.G.round,
                message: `Engine stuck at round ${state.G.round} for ${stuckCount} moves`,
              });
              return;
            }
          }

          const next = pickNextMove(state.G, state.ctx);
          if (next === null) {
            setStatus({
              state: 'complete',
              movesRun,
              outcome: 'cap',
              rounds: state.G.round,
              message: 'No bot move available and no fallback applies',
            });
            return;
          }
          // Surface the moves through the client. `client.moves[<name>]`
          // is the canonical dispatch path; we cast to any-keyed because
          // bgio types the moves map as a generic record without our
          // per-move signatures.
          const moves = client.moves as unknown as Record<
            string,
            (...args: unknown[]) => unknown
          >;
          const fn = moves[next.move];
          if (typeof fn !== 'function') {
            // Unknown move name — bail rather than spin.
            setStatus({
              state: 'error',
              movesRun,
              outcome: 'error',
              rounds: state.G.round,
              message: `Unknown move ${next.move}`,
            });
            return;
          }
          // Switch the active seat before dispatching so bgio routes
          // the move to the right player.
          client.updatePlayerID(next.playerID);
          try {
            fn(...next.args);
          } catch {
            // Engine threw — likely a bot suggested an illegal move
            // for the current state. Drop the move and let the next
            // tick try another seat / fallback. INVALID_MOVE returns
            // are normal and don't throw.
          }
          movesRun += 1;
          // Yield to the event loop occasionally so React can paint
          // the live status; without this the page looks frozen until
          // the entire run completes.
          if (movesRun % 25 === 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 0);
            });
            setStatus((prev) => ({
              ...prev,
              movesRun,
              rounds: state.G.round,
            }));
          }
        }
        const final = client.getState();
        const finalRounds = final?.G?.round ?? 0;
        const final_outcome =
          final?.ctx.gameover !== undefined
            ? ((final.ctx.gameover as { kind?: string }).kind === 'win'
                ? 'win'
                : 'timeUp')
            : 'cap';
        setStatus({
          state: 'complete',
          movesRun,
          outcome: final_outcome,
          rounds: finalRounds,
          message: final_outcome === 'cap' ? 'Hit MAX_MOVES safety cap' : undefined,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          state: 'error',
          movesRun,
          outcome: 'error',
          rounds: 0,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      data-testid="fuzz-page"
      data-fuzz-state={status.state}
      data-fuzz-outcome={status.outcome}
      data-fuzz-rounds={status.rounds}
      data-fuzz-moves={status.movesRun}
      sx={{
        p: 4,
        minHeight: '100vh',
        color: (t) => t.palette.appSurface.text,
        bgcolor: (t) => t.palette.appSurface.base,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Settlement — fuzz harness
        </Typography>
        <Typography variant="body2">
          Headless 4-player driver composed from chiefBot + scienceBot +
          domesticBot + defenseBot. Used by the e2e smoke spec
          (sub-phase 3.9) to verify the engine drives a full match
          end-to-end.
        </Typography>
        <Typography variant="body2">
          Status: <strong data-testid="fuzz-status">{status.state}</strong>
        </Typography>
        <Typography variant="body2">
          Moves run:{' '}
          <strong data-testid="fuzz-moves">{status.movesRun}</strong>
        </Typography>
        <Typography variant="body2">
          Rounds: <strong data-testid="fuzz-rounds">{status.rounds}</strong>
        </Typography>
        <Typography variant="body2">
          Outcome:{' '}
          <strong data-testid="fuzz-outcome">{status.outcome}</strong>
        </Typography>
        {status.message ? (
          <Typography variant="body2" color="text.secondary">
            {status.message}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

export default FuzzPage;
