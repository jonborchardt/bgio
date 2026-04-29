// 10.9 — seat takeover (human ↔ bot swap).
//
// Real implementation: mutate `match.metadata.players[playerID].isBot`
// through bgio's storage adapter. The running `Server` consults the
// metadata on its next dispatch tick (it forwards moves from the
// matching socket only when isBot is false), so flipping the flag is
// what actually makes the bot driver pick up the seat.
//
// We bind the bgio Server (and through it, the storage adapter) via a
// module-scoped setter rather than threading it through every call
// site. That keeps the public function signatures (and the tests that
// spy on them) unchanged from the V1 stub.
//
// Per CLAUDE.md: this is a thin shell over the bgio primitive
// (`match.metadata`), not a parallel system.

/** Shape of a bgio playerID. bgio uses bare strings ('0', '1', …) but
 * doesn't export a named type from the top-level entry. */
export type PlayerID = string;

/** Minimal shape we need off bgio's Server to mutate metadata. The
 * actual `Server` instance has many more fields; we keep our coupling
 * narrow. */
interface BgioMetadataStore {
  fetch: (
    matchID: string,
    opts: { metadata?: boolean },
  ) => Promise<{ metadata?: BgioMatchMetadata }>;
  setMetadata: (
    matchID: string,
    metadata: BgioMatchMetadata,
  ) => Promise<void>;
}

interface BgioMatchMetadata {
  players?: Record<string, { isBot?: boolean; name?: string } | undefined>;
  // bgio's metadata has more fields (gameName, setupData, gameover, …)
  // but we only touch `players` here. Rest pass through verbatim.
  [k: string]: unknown;
}

/** The bgio Server has a `db` field of shape `BgioMetadataStore`. We
 * type it loosely because bgio doesn't export the storage interface
 * from the top-level entry; this matches what we already do in
 * `server/storage/sqlite.ts`. */
interface BgioServerLike {
  db?: BgioMetadataStore;
}

let activeServer: BgioServerLike | null = null;

/** Called by `makeIdleWatcher(server)` so subsequent grant/revoke
 * calls can reach the storage adapter. Test harnesses that drive
 * grant/revoke directly can call this with a mock store. */
export const setBgioServer = (server: unknown): void => {
  activeServer = (server as BgioServerLike) ?? null;
};

const getDb = (): BgioMetadataStore | null => {
  const db = activeServer?.db;
  return db && typeof db.fetch === 'function' && typeof db.setMetadata === 'function'
    ? db
    : null;
};

const updateIsBot = async (
  matchID: string,
  playerID: PlayerID,
  isBot: boolean,
): Promise<void> => {
  const db = getDb();
  if (!db) {
    // No server bound (e.g. the watcher was constructed with a stub
    // server, or tests didn't set one). Stay best-effort: log and
    // return so callers don't have to special-case.
    console.info(
      `[idle] ${isBot ? 'grantBotControl' : 'revokeBotControl'}(matchID=${matchID}, playerID=${playerID}) — no db bound, skipping`,
    );
    return;
  }
  const fetched = await db.fetch(matchID, { metadata: true });
  const metadata: BgioMatchMetadata = fetched.metadata ?? {};
  const players: Record<string, { isBot?: boolean; name?: string } | undefined> =
    { ...(metadata.players ?? {}) };
  const existing = players[playerID] ?? {};
  if (existing.isBot === isBot) {
    // Idempotent — bgio's bot driver is already in the desired state.
    return;
  }
  players[playerID] = { ...existing, isBot };
  await db.setMetadata(matchID, { ...metadata, players });
};

/** Take a match seat away from a (presumed-idle) human and hand it to
 * a server-side bot. Idempotent: writing isBot=true twice is a no-op
 * on the second call. */
export const grantBotControl = async (
  matchID: string,
  playerID: PlayerID,
): Promise<void> => {
  await updateIsBot(matchID, playerID, true);
};

/** Inverse of `grantBotControl`. Called when the human reconnects:
 * clears `isBot` so bgio stops driving the seat with a bot. */
export const revokeBotControl = async (
  matchID: string,
  playerID: PlayerID,
): Promise<void> => {
  await updateIsBot(matchID, playerID, false);
};

/** Test helper — wipe the bound server so subsequent calls fall back
 * to the no-db log-only path. */
export const __resetSeatTakeoverForTest = (): void => {
  activeServer = null;
};
