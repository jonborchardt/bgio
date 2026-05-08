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
import type { Ctx } from 'boardgame.io';
import { Settlement } from '../../src/game/index.ts';
import {
  assignRoles,
  rolesAtSeat,
  seatOfRole,
} from '../../src/game/roles.ts';
import type { Role, SettlementState } from '../../src/game/types.ts';
import { chiefBot } from '../../src/game/ai/chiefBot.ts';
import { scienceBot } from '../../src/game/ai/scienceBot.ts';
import { domesticBot } from '../../src/game/ai/domesticBot.ts';
import { defenseBot } from '../../src/game/ai/defenseBot.ts';
import type { MoveCandidate } from '../../src/game/ai/enumerate.ts';
import { botCredentialsFor } from '../auth/authenticateCredentials.ts';
import {
  grantBotControl,
  revokeBotControl,
  type BgioServerLike as TakeoverBgioServerLike,
} from '../idle/seatTakeover.ts';

/** Per-role smart bots. Each `play()` returns at most one MoveCandidate
 * for the seat-on-stage state, or null when the bot has nothing it
 * wants to do. The composed dispatch below tries every role at the
 * seat in turn (1p / 2p variants stack roles per seat). */
const ROLE_BOTS: Record<
  Role,
  {
    play: (state: {
      G: SettlementState;
      ctx: Ctx;
      playerID: string;
    }) => MoveCandidate | null;
  }
> = {
  chief: chiefBot,
  science: scienceBot,
  domestic: domesticBot,
  defense: defenseBot,
};

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

/** Ask the smart per-role bots whether they want to play a move at this
 * seat-state. Returns the first non-null MoveCandidate from any role
 * the seat owns (1p / 2p variants stack multiple roles per seat).
 *
 * The smart bots encode production-sensible heuristics — "burn at most
 * once per round, prefer cheap buys" for science; "distribute toward
 * highest demand, end phase when bank is dry" for chief; etc. They're
 * what makes a bot match playable; the enumerate-random fallback below
 * is only there to avoid a stuck seat if the smart bot returns null
 * unexpectedly. */
const pickSmartBotMove = (
  G: SettlementState,
  ctx: Ctx,
  playerID: string,
): MoveCandidate | null => {
  let roles: readonly Role[];
  try {
    roles = rolesAtSeat(G.roleAssignments, playerID);
  } catch {
    return null;
  }
  for (const role of roles) {
    const bot = ROLE_BOTS[role];
    if (!bot) continue;
    try {
      const action = bot.play({ G, ctx, playerID });
      if (action !== null) return action;
    } catch {
      // A throwing per-role bot must not stall the driver. Fall through
      // to the next role; if all fail, the enumerate-random fallback
      // still produces a candidate.
    }
  }
  return null;
};

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

          // othersPhase parks every non-chief seat in its role-stage
          // (scienceTurn / domesticTurn / defenseTurn) until ALL seats
          // have flipped `G.othersDone[seat] = true`. Individual seats
          // don't leave the stage on their own — they wait for the
          // last seat to declare done so phase.endIf transitions the
          // phase. For bots this means: after dispatching seatDone,
          // the seat is still listed in `ctx.activePlayers` even
          // though it has nothing more to do. We must not re-dispatch
          // for a seat that's flipped its done flag, or we burn ticks
          // on no-op moves (or worse, dispatch a stray buy / event
          // play after the bot already declared done).
          const othersDone =
            (state.G as { othersDone?: Record<string, boolean> }).othersDone ??
            {};

          const seats = seatsActive(state);
          for (const playerID of seats) {
            if (metadata.players[playerID]?.isBot !== true) continue;
            if (othersDone[playerID] === true) continue;

            // Smart-bot path: ask the per-role heuristic bot for this
            // seat first. If it returns null (no preferred move at this
            // state), fall back to enumerate's random pick. Without
            // this, the driver picks uniformly across enumerate's
            // candidate list — for a science seat with N face-up
            // library cards that's N burn candidates vs ~1 seatDone,
            // so the bot burns the whole row before randomly picking
            // seatDone.
            const enumerate = Settlement.ai?.enumerate;
            if (typeof enumerate !== 'function') break;

            const G = state.G as SettlementState;
            const ctx = state.ctx as unknown as Ctx;
            let raw: unknown = pickSmartBotMove(G, ctx, playerID);
            if (raw === null) {
              const candidates = enumerate(G, ctx, playerID);
              if (!Array.isArray(candidates) || candidates.length === 0) {
                break;
              }
              raw = candidates[pickIndex(candidates.length)];
            }
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
