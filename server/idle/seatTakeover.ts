// 10.9 — seat takeover (human ↔ bot swap).
//
// **V1 stub:** the real implementation needs to mutate
// `match.metadata.bots` through bgio's storage adapter so the running
// `Server` picks up the change on its next tick. That requires:
//
//   1. A handle to the storage adapter (or to bgio's Server instance,
//      from which we can reach the adapter via a private field).
//   2. Knowing which bot to register (per-role heuristic from 11.x —
//      none of those are wired yet).
//   3. A test harness that can roundtrip the metadata update through
//      bgio's running game loop.
//
// None of those are present in this slice. We ship the API shape and
// log statements so the watcher (`idleWatcher.ts`) can call into us
// without crashing, and the integration lands when 11.3-11.6 do. The
// `it.todo`s in `tests/server/idle.test.ts` pin the work.
//
// Per CLAUDE.md: when bgio's primitive falls short of a real
// requirement, we layer a thin shell over it rather than inventing a
// parallel system. `match.metadata.bots` IS that primitive — we just
// haven't wired the writer yet.

/** Shape of a bgio playerID. bgio uses bare strings ('0', '1', …) but
 * doesn't export a named type from the top-level entry. We mirror the
 * shape locally to keep the public API documented. */
export type PlayerID = string;

/** Take a match seat away from a (presumed-idle) human and hand it to
 * a server-side bot. Idempotent: calling twice for the same
 * (matchID, playerID) is a no-op on the second call.
 *
 * V1: this is a stub that logs the takeover; the real metadata.bots
 * mutation lands once bots from 11.3-11.6 are registered on the
 * server. */
export const grantBotControl = async (
  matchID: string,
  playerID: PlayerID,
): Promise<void> => {
  console.info(
    `[idle] grantBotControl(matchID=${matchID}, playerID=${playerID}) — stub (10.9)`,
  );
};

/** Inverse of `grantBotControl`. Called when the human reconnects:
 * removes the seat from `match.metadata.bots` so bgio stops driving
 * it and forwards moves from the human's socket again.
 *
 * V1: stub for the same reason as `grantBotControl`. */
export const revokeBotControl = async (
  matchID: string,
  playerID: PlayerID,
): Promise<void> => {
  console.info(
    `[idle] revokeBotControl(matchID=${matchID}, playerID=${playerID}) — stub (10.9)`,
  );
};
