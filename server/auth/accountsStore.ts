// 10.7 follow-up — accounts store contract + in-memory default.
//
// The accounts module's public API (`register` / `login` / `verify`)
// stays the same; it now reads / writes through this Store interface
// rather than poking Maps directly. The default at boot is the
// `createMemoryAccountsStore()` factory below — drop-in compatible
// with the original behavior. Production switches to the SQLite store
// from `./sqliteAccountsStore.ts` via `setAccountsStore(...)` in
// `server/index.ts` when `STORAGE_KIND=sqlite`.

export interface AccountUserRow {
  /** uuid v4 */
  id: string;
  /** Preserved-case username as the user provided it. */
  username: string;
  passwordHash: string;
  /** Epoch ms when the user was created. */
  createdAt: number;
}

export interface AccountTokenRow {
  userID: string;
  /** Epoch ms when this token was issued. */
  issuedAt: number;
  /** Epoch ms when this token stops being valid. */
  expiresAt: number;
}

/**
 * Backing store for the accounts module. Implementations:
 *   - `createMemoryAccountsStore()` — `Map`-backed (default; matches
 *     the V1 in-memory behavior and is what the test suite uses).
 *   - `createSqliteAccountsStore({ path })` — better-sqlite3 against
 *     the `users` + `auth_tokens` tables.
 *
 * The interface is sync because the previous in-memory module was
 * sync; both implementations can satisfy that. Async would force the
 * SQLite store's hot path to spawn worker threads or queue
 * microtasks for what better-sqlite3 already serves synchronously.
 */
export interface AccountsStore {
  /** Case-insensitive lookup. Caller passes `username.toLowerCase()`. */
  findUserByLower(lower: string): AccountUserRow | undefined;
  findUserById(id: string): AccountUserRow | undefined;
  /** Throws if the lowercased username is already taken — callers
   *  always check first, but the unique-key enforcement also lives
   *  here so a racing duplicate write fails loudly. */
  insertUser(row: AccountUserRow): void;
  findToken(token: string): AccountTokenRow | undefined;
  insertToken(token: string, row: AccountTokenRow): void;
  deleteToken(token: string): void;
  /** Test helper — wipe every row. Hooked up to `__resetAccountsForTest`. */
  clear(): void;
  /** Test helper — shift `issuedAt` and `expiresAt` by `ageMs` so the
   *  rotation / expiry branches in `verify` can be exercised
   *  deterministically. Returns false if the token is unknown. */
  backdateToken(token: string, ageMs: number): boolean;
}

export const createMemoryAccountsStore = (): AccountsStore => {
  // Keyed by username.toLowerCase() — `username TEXT UNIQUE COLLATE NOCASE`
  // in the SQLite schema. The lowercase key matches that semantics.
  const usersByLower = new Map<string, AccountUserRow>();
  const tokens = new Map<string, AccountTokenRow>();

  return {
    findUserByLower(lower) {
      return usersByLower.get(lower);
    },
    findUserById(id) {
      for (const candidate of usersByLower.values()) {
        if (candidate.id === id) return candidate;
      }
      return undefined;
    },
    insertUser(row) {
      const lower = row.username.toLowerCase();
      if (usersByLower.has(lower)) {
        throw new Error('username already taken');
      }
      usersByLower.set(lower, row);
    },
    findToken(token) {
      return tokens.get(token);
    },
    insertToken(token, row) {
      tokens.set(token, row);
    },
    deleteToken(token) {
      tokens.delete(token);
    },
    clear() {
      usersByLower.clear();
      tokens.clear();
    },
    backdateToken(token, ageMs) {
      const row = tokens.get(token);
      if (!row) return false;
      row.issuedAt -= ageMs;
      row.expiresAt -= ageMs;
      return true;
    },
  };
};
