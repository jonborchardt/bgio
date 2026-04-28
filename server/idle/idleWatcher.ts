// 10.9 — idle watcher.
//
// Records the last activity timestamp per (matchID, playerID) and, on a
// periodic sweep, hands an idle seat over to a server-side bot via
// `grantBotControl` (10.9 seatTakeover). The watcher is bounded — one
// `setInterval` per server instance, not per match — so memory stays
// linear in match count.
//
// V1 limitations:
//   - Stage gating ("only take over if it's actually that seat's turn")
//     requires reading game state from a storage adapter handle. The
//     plan punts that until the bot driver in 11.x lands; for V1 we
//     just call `grantBotControl` once a seat has been silent past
//     IDLE_TIMEOUT_MS and let bgio's bot driver decide whether to act
//     on it. The seatTakeover module is itself a stub (see 10.9 doc),
//     so no real moves fire — this layering means the watcher can
//     ship now and the seat-flip lights up automatically when the
//     stub is filled in.
//   - There's no chat-message integration ("Bot took over for X") in
//     this slice; that's part of 10.9 step 3 and lands with the real
//     takeover.
//
// The watcher exposes `__sweepNow()` for tests so we don't need to
// fast-forward `setInterval`. The interval timer is a cheap
// implementation detail; deterministic sweep is what the tests pin.

// Namespace import lets tests replace `grantBotControl` via `vi.spyOn`
// (or the equivalent) — direct named imports compile to immutable
// bindings that a spy can't intercept. We only re-export the type as a
// named import below.
import * as seatTakeover from './seatTakeover.ts';
import type { PlayerID } from './seatTakeover.ts';

/** Idle timeout. After this much silence on a seat the watcher hands
 * the seat to a bot. Plan-default 5 minutes. */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Sweep interval. The watcher checks every 30 seconds — the takeover
 * happens at a granularity of `IDLE_TIMEOUT_MS + (0..SWEEP_INTERVAL_MS)`. */
export const SWEEP_INTERVAL_MS = 30 * 1000;

/** Public watcher API (matches the 10.9 plan). */
export interface IdleWatcher {
  /** Begin the periodic sweep. Idempotent: calling twice does not
   * double-schedule. */
  start: () => void;
  /** Stop the periodic sweep. Idempotent. */
  stop: () => void;
  /** Note that `playerID` in `matchID` just sent input. Resets the idle
   * timer for that seat. The watcher records (matchID, playerID) the
   * first time it sees the pair, so callers don't need a separate
   * "register seat" step. */
  noteActivity: (matchID: string, playerID: PlayerID) => void;
  /** Test hook — runs the idle sweep synchronously rather than waiting
   * for the next interval tick. */
  __sweepNow: () => Promise<void>;
  /** Test hook — read the current activity table. */
  __getLastActivity: () => Map<string, Map<PlayerID, number>>;
}

/** Bgio Server instance — passed in for future hooks (e.g. reading
 * `state.G` to decide whose stage it is, or to send a chat message via
 * `client.sendChatMessage`). V1 doesn't dereference any of that; we
 * type the parameter as `unknown` to avoid leaking bgio's private
 * `Server` shape into our public surface. */
export type BgioServer = unknown;

export const makeIdleWatcher = (_server: BgioServer): IdleWatcher => {
  // matchID -> playerID -> last activity epoch ms.
  const lastActivity = new Map<string, Map<PlayerID, number>>();
  // Tracks which (matchID, playerID) pairs we've already handed off
  // to a bot, so the sweep doesn't fire `grantBotControl` on every
  // tick after the timeout.
  const granted = new Set<string>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const pairKey = (matchID: string, playerID: PlayerID): string =>
    `${matchID} ${playerID}`;

  const noteActivity = (matchID: string, playerID: PlayerID): void => {
    let perMatch = lastActivity.get(matchID);
    if (!perMatch) {
      perMatch = new Map<PlayerID, number>();
      lastActivity.set(matchID, perMatch);
    }
    perMatch.set(playerID, Date.now());
    // Activity from a previously-bot-controlled seat means the human
    // came back; future hook will call `revokeBotControl` here. V1
    // just clears the granted flag so the sweep stops re-firing.
    granted.delete(pairKey(matchID, playerID));
  };

  const sweep = async (): Promise<void> => {
    const now = Date.now();
    for (const [matchID, perMatch] of lastActivity) {
      for (const [playerID, last] of perMatch) {
        if (now - last <= IDLE_TIMEOUT_MS) continue;
        const key = pairKey(matchID, playerID);
        if (granted.has(key)) continue;
        granted.add(key);
        try {
          await seatTakeover.grantBotControl(matchID, playerID);
        } catch (err) {
          // A failed takeover shouldn't crash the watcher; log and
          // continue. The plan calls this out explicitly: "Watcher
          // survives a single bad bot move (logged, not crash)".
          console.warn(
            `[idle] grantBotControl failed for ${key}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  };

  const start = (): void => {
    if (timer !== null) return;
    timer = setInterval(() => {
      void sweep();
    }, SWEEP_INTERVAL_MS);
    // Ensure the timer doesn't keep Node alive. setInterval returns a
    // Timeout in Node; .unref is a Node-specific method (no-op-able if
    // we ever run in a different env, hence the runtime check).
    if (timer && typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as { unref: () => void }).unref();
    }
  };

  const stop = (): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  return {
    start,
    stop,
    noteActivity,
    __sweepNow: sweep,
    __getLastActivity: () => lastActivity,
  };
};
