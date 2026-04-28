// Credentials persistence (10.6).
//
// We persist the (matchID, playerID, credentials, serverUrl) tuple in
// localStorage so a page reload mid-match restores the seat without
// re-routing through the lobby. The expiry is generous (24h) — the
// upper-bound game length is 80 rounds (08.5), and even slow async
// matches won't run a full day. Anything older than 24h likely means
// the player is on a brand-new game and should hit the lobby again.
//
// We use a single storage key to keep the wipe surface trivial. If
// auth (10.7) needs a separate token, that goes in its own key — we
// don't co-mingle.

const KEY = 'settlement.session';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionCreds {
  matchID: string;
  playerID: string;
  credentials: string;
  serverUrl: string;
  /** Epoch ms after which `loadCreds()` treats the entry as stale. */
  expiresAt: number;
}

const safeStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    // Touching `localStorage` can throw on pages without storage
    // permission (rare; private-browsing edge cases). Tolerate.
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Persist the given creds. Computes `expiresAt` if the caller didn't
 * supply one — most callers shouldn't bother. */
export const saveCreds = (
  creds: Omit<SessionCreds, 'expiresAt'> & { expiresAt?: number },
): void => {
  const storage = safeStorage();
  if (!storage) return;
  const payload: SessionCreds = {
    matchID: creds.matchID,
    playerID: creds.playerID,
    credentials: creds.credentials,
    serverUrl: creds.serverUrl,
    expiresAt: creds.expiresAt ?? Date.now() + TTL_MS,
  };
  try {
    storage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota / serialization errors — non-fatal; reload will re-route to lobby.
  }
};

/** Read previously-saved creds. Returns `null` when missing, expired,
 * or unparseable; auto-clears stale entries to keep the slot tidy. */
export const loadCreds = (): SessionCreds | null => {
  const storage = safeStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearCreds();
    return null;
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    typeof (parsed as { matchID?: unknown }).matchID !== 'string' ||
    typeof (parsed as { playerID?: unknown }).playerID !== 'string' ||
    typeof (parsed as { credentials?: unknown }).credentials !== 'string' ||
    typeof (parsed as { serverUrl?: unknown }).serverUrl !== 'string' ||
    typeof (parsed as { expiresAt?: unknown }).expiresAt !== 'number'
  ) {
    clearCreds();
    return null;
  }
  const creds = parsed as SessionCreds;
  if (creds.expiresAt < Date.now()) {
    clearCreds();
    return null;
  }
  return creds;
};

/** Remove the persisted creds (e.g. on a logout / leaveMatch). */
export const clearCreds = (): void => {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
};
