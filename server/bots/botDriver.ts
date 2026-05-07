// Issue 003 — server-side bot driver.
//
// CLAUDE.md's project stance is "Default game is 4 players, 1 human + 3 bots."
// bgio's `Server` itself does NOT auto-drive bots: each socket message spawns
// its own Master, so a seat marked `metadata.players[id].isBot=true` simply
// goes silent unless something dispatches its moves. This driver fills that
// gap.
//
// Approach: a small polling loop. Each tick:
//   1. List matches via the storage adapter.
//   2. For each match, fetch state + metadata.
//   3. For each active seat (`ctx.activePlayers` or `ctx.currentPlayer`)
//      whose metadata flag is `isBot === true`, ask the game's
//      `ai.enumerate(G, ctx, playerID)` for legal moves.
//   4. Pick one (RandomBot-style: uniform random) and dispatch via a fresh
//      `Master` constructed against the same storage / auth / pubSub the
//      live SocketIO transport uses, so connected clients receive the
//      `update` broadcast through the existing pubSub channel.
//
// Constraints we honor:
//   - **No client process.** The driver runs in-process with the bgio Server.
//   - **Idempotent vs. idleWatcher.** When `seatTakeover` flips `isBot=true`
//     on an abandoned seat, this driver picks it up on its next tick — no
//     extra wiring is required.
//   - **Bounded work per tick.** One bot move per match per tick keeps the
//     loop predictable; the next tick handles follow-ups.
//   - **Replay determinism.** Bot moves go through the same Master path as
//     human moves, so `state.deltalog` records them identically.
//
// We keep the driver lazy: nothing happens until at least one match has a
// bot-flagged seat. That's why `start()` is unconditionally called from
// `createServer` — it's a no-op when nobody's playing.

import { randomInt } from 'node:crypto';
import { Master } from 'boardgame.io/master';
import { Settlement } from '../../src/game/index.ts';
import { botCredentialsFor } from '../auth/authenticateCredentials.ts';

/** Default poll cadence. Render's free tier is mostly idle; 1s is brisk
 * enough that a bot's turn doesn't visibly hang while not hammering the
 * storage adapter. */
export const DEFAULT_TICK_MS = 1000;

interface BgioState {
  G: unknown;
  ctx: {
    currentPlayer: string;
    activePlayers: Record<string, string> | null;
    gameover?: unknown;
  };
  _stateID: number;
}

interface BgioMatchMetadata {
  players?: Record<
    string,
    { isBot?: boolean; name?: string; credentials?: string } | undefined
  >;
  gameover?: unknown;
  [k: string]: unknown;
}

interface BgioStorage {
  listMatches?: (opts?: { gameName?: string }) => Promise<string[]> | string[];
  fetch: (
    matchID: string,
    opts: { state?: boolean; metadata?: boolean },
  ) => Promise<{ state?: BgioState; metadata?: BgioMatchMetadata }>;
}

interface BgioAuth {
  authenticateCredentials: (args: unknown) => Promise<boolean> | boolean;
}

interface PubSubLike {
  publish: (channelId: string, payload: unknown) => void;
  subscribe: (channelId: string, callback: (payload: unknown) => void) => void;
}

interface BgioServerLike {
  db?: BgioStorage;
  auth?: BgioAuth;
  transport?: { pubSub?: PubSubLike };
}

export interface BotDriver {
  start: () => void;
  stop: () => void;
  /** Run a single tick synchronously. Tests use this to drive the loop
   * without starting a real timer. */
  __tickNow: () => Promise<void>;
}

export interface MakeBotDriverOptions {
  server: BgioServerLike;
  /** Override the cadence. Tests pass `0` and use `__tickNow()` only. */
  intervalMs?: number;
  /** Inject a deterministic picker for tests. Receives the candidate
   * count and returns an index in `[0, n)`. Defaults to
   * `crypto.randomInt(n)` — game-state randomness still flows through
   * the bgio random plugin; this only chooses which legal candidate
   * the bot dispatches. */
  pickIndex?: (candidateCount: number) => number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const seatsActive = (state: BgioState): string[] => {
  const ap = state.ctx.activePlayers;
  if (ap && Object.keys(ap).length > 0) return Object.keys(ap);
  if (state.ctx.currentPlayer) return [state.ctx.currentPlayer];
  return [];
};

/** Build the TransportAPI the Master expects. Matches bgio's
 * SocketIO `TransportAPI` shape — `send` is per-client (no-op for bot
 * dispatch since there's no socket) and `sendAll` fans out via the
 * shared pubSub. The connected SocketIO clients are subscribed to the
 * same channel via `transport.subscribePubSubChannel`, so `update`
 * payloads we publish reach every live socket in the match room. */
const makeTransportAPI = (matchID: string, pubSub: PubSubLike | undefined) => ({
  send: () => {
    /* no socket bound to bot dispatch */
  },
  sendAll: (payload: unknown) => {
    pubSub?.publish(`MATCH-${matchID}`, payload);
  },
});

export const makeBotDriver = ({
  server,
  intervalMs = DEFAULT_TICK_MS,
  pickIndex = (n) => randomInt(n),
}: MakeBotDriverOptions): BotDriver => {
  let timer: ReturnType<typeof setInterval> | undefined;
  let isTicking = false;

  const tick = async (): Promise<void> => {
    if (isTicking) return;
    isTicking = true;
    try {
      const db = server.db;
      const auth = server.auth;
      const pubSub = server.transport?.pubSub;
      if (!db?.fetch || typeof db.listMatches !== 'function') return;

      const matchIDs = await Promise.resolve(db.listMatches());
      for (const matchID of matchIDs) {
        try {
          const fetched = await db.fetch(matchID, {
            state: true,
            metadata: true,
          });
          const state = fetched.state;
          const metadata = fetched.metadata;
          if (!state || !metadata?.players) continue;
          if (state.ctx.gameover !== undefined) continue;

          const seats = seatsActive(state);
          for (const playerID of seats) {
            if (metadata.players[playerID]?.isBot !== true) continue;

            const enumerate = Settlement.ai?.enumerate;
            if (typeof enumerate !== 'function') break;

            const candidates = enumerate(
              state.G as Parameters<typeof enumerate>[0],
              state.ctx as Parameters<typeof enumerate>[1],
              playerID,
            );
            if (!Array.isArray(candidates) || candidates.length === 0) break;

            const raw = candidates[pickIndex(candidates.length)];
            // bgio's enumerate union covers move / event / pre-built actions.
            // We only handle the `{ move, args? }` shape — everything else
            // falls through to the next tick.
            if (!isObject(raw)) break;
            const move = (raw as { move?: unknown }).move;
            if (typeof move !== 'string') break;
            const rawArgs = (raw as { args?: unknown }).args;
            const args = Array.isArray(rawArgs) ? rawArgs : [];
            const master = new Master(
              Settlement,
              db as unknown as ConstructorParameters<typeof Master>[1],
              makeTransportAPI(matchID, pubSub),
              auth as unknown as ConstructorParameters<typeof Master>[3],
            );
            await master.onUpdate(
              {
                type: 'MAKE_MOVE',
                payload: {
                  type: move,
                  args,
                  credentials: botCredentialsFor(playerID),
                  playerID,
                },
              } as unknown as Parameters<Master['onUpdate']>[0],
              state._stateID,
              matchID,
              playerID,
            );
            // One move per match per tick — let the next tick pick up
            // the resulting state for any follow-up bot turns.
            break;
          }
        } catch (err) {
          // Don't crash the whole loop on a single match failure.
          console.warn(
            `[bots] tick for matchID=${matchID} failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } finally {
      isTicking = false;
    }
  };

  return {
    start: () => {
      if (timer || intervalMs <= 0) return;
      timer = setInterval(() => {
        void tick();
      }, intervalMs);
      // Don't keep the Node event loop alive on the bot timer — the HTTP
      // server is the keepalive we want.
      if (typeof (timer as { unref?: () => void }).unref === 'function') {
        (timer as { unref: () => void }).unref();
      }
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
    __tickNow: tick,
  };
};
