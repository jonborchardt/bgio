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
import { assignRoles, seatOfRole } from '../../src/game/roles.ts';
import type { Role } from '../../src/game/types.ts';
import { botCredentialsFor } from '../auth/authenticateCredentials.ts';
import {
  grantBotControl,
  revokeBotControl,
  type BgioServerLike as TakeoverBgioServerLike,
} from '../idle/seatTakeover.ts';

/** The credentialed-MAKE_MOVE action shape bgio's Master expects.
 *  Mirrors the exported `CredentialedActionShape.MakeMove` type but
 *  spelled here so we don't depend on bgio's deep import path. */
interface CredentialedMakeMove {
  type: 'MAKE_MOVE';
  payload: {
    type: string;
    args: unknown[];
    playerID: string;
    credentials: string;
  };
}

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

/** Solo-mode wiring (issue: solo matches hung silently because nothing
 * marked the non-human seats as bots).
 *
 * The lobby's CreateMatchForm posts `setupData: { soloMode, humanRole }`
 * which `src/game/setup.ts` copies into `state.G._setup`. This helper
 * reads that flag and, for every non-human seat in the canonical role
 * assignment:
 *   - If no human has joined the seat (`name` undefined), mark it as a
 *     bot so the dispatch loop below picks it up.
 *   - If a human HAS joined the seat (e.g., a friend grabbed a slot in
 *     a "solo" match anyway), revoke any prior bot flag so the seat
 *     goes back to the human. Without this, the auth hook only accepts
 *     the synthetic `bot:<seat>` credential when isBot=true and the
 *     joining human stalls forever on bgio's "connecting…" screen.
 * `grantBotControl` / `revokeBotControl` are both idempotent, so
 * re-running this every tick is cheap.
 *
 * Why here and not at match-create time: bgio's `Server` doesn't expose
 * a hook on the create-match REST endpoint that lets us mutate metadata
 * post-create. Doing it from the bot driver's poll uses infrastructure
 * we already have (db.fetch + grant/revokeBotControl) and self-heals
 * if the metadata is ever stomped — the next tick re-flags the seats. */
const markSoloBotSeats = async (
  server: BgioServerLike,
  matchID: string,
  state: BgioState,
  metadata: BgioMatchMetadata,
): Promise<void> => {
  const setup = (state.G as { _setup?: { soloMode?: boolean; humanRole?: Role } })
    ._setup;
  if (setup?.soloMode !== true) return;
  if (setup.humanRole === undefined) return;
  if (!metadata.players) return;
  const numPlayers = Object.keys(metadata.players).length;
  if (numPlayers < 1 || numPlayers > 4) return;
  const assignments = assignRoles(numPlayers as 1 | 2 | 3 | 4);
  const humanSeat = seatOfRole(assignments, setup.humanRole);
  // The two BgioServerLike interfaces describe non-overlapping slices
  // of the same runtime object (botDriver wants `db.fetch` +
  // `db.listMatches`; seatTakeover wants `db.fetch` + `db.setMetadata`).
  // The actual server has all four; the cast bridges the two narrow
  // views.
  const takeoverServer = server as unknown as TakeoverBgioServerLike;
  for (const seat of Object.keys(assignments)) {
    if (seat === humanSeat) continue;
    const player = metadata.players[seat];
    // bgio's `joinMatch` REST sets `name` (and `credentials`) on the
    // player entry — `name` being defined is the canonical "a human
    // has occupied this seat" signal that's also visible in the
    // listMatches payload (credentials are stripped from the public
    // listing).
    const humanJoined = typeof player?.name === 'string';
    if (humanJoined) {
      if (player?.isBot === true) {
        // Stale bot flag from a prior tick. Hand the seat back so the
        // human's auth check (which only accepts a synthetic
        // `bot:<seat>` credential when isBot=true) starts passing.
        await revokeBotControl(takeoverServer, matchID, seat);
        metadata.players[seat] = { ...(player ?? {}), isBot: false };
      }
      continue;
    }
    if (player?.isBot === true) continue;
    await grantBotControl(takeoverServer, matchID, seat);
    metadata.players[seat] = { ...(player ?? {}), isBot: true };
  }
};

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

          // Solo-mode wiring: lazily mark non-human seats as bots so
          // the dispatch loop below can drive them. Idempotent.
          await markSoloBotSeats(server, matchID, state, metadata);

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
            // bgio's `Async`/`Auth` types aren't exported from the
            // public surface, so the constructor casts pass our local
            // interfaces through `unknown as`. Each duck-types the
            // shape Master actually consumes (fetch / setState /
            // setMetadata for Async; authenticateCredentials for
            // Auth) — runtime-checked when the master fires.
            const master = new Master(
              Settlement,
              db as unknown as ConstructorParameters<typeof Master>[1],
              makeTransportAPI(matchID, pubSub),
              auth as unknown as ConstructorParameters<typeof Master>[3],
            );
            const action: CredentialedMakeMove = {
              type: 'MAKE_MOVE',
              payload: {
                type: move,
                args,
                credentials: botCredentialsFor(playerID),
                playerID,
              },
            };
            await master.onUpdate(
              // The local `CredentialedMakeMove` literally matches
              // `CredentialedActionShape.MakeMove`, but bgio's union
              // `CredentialedActionShape.Any` resolves to a deep
              // import; one cast keeps onUpdate's signature clean.
              action as unknown as Parameters<Master['onUpdate']>[0],
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
