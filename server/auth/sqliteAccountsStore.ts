// 10.7 follow-up — SQLite-backed AccountsStore.
//
// Talks to the same `users` and `auth_tokens` tables created by
// migration `002_users_and_runs.sql`. We open our own better-sqlite3
// connection to the DB file (SQLite supports concurrent connections;
// WAL mode is enabled in `server/storage/sqlite.ts`'s constructor and
// stays in effect for the file). This keeps the accounts module
// loosely coupled from the bgio match-storage adapter — they share a
// file but not an object reference.
//
// Native dep gating: like `server/storage/sqlite.ts` we createRequire
// for `better-sqlite3` so a missing native module surfaces at
// construction time with a clear error rather than at typecheck.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AccountsStore,
  AccountTokenRow,
  AccountUserRow,
} from './accountsStore.ts';

const require_ = createRequire(import.meta.url);

interface BetterSqliteStatement {
  run(...args: unknown[]): { changes: number };
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface BetterSqliteDatabase {
  prepare(sql: string): BetterSqliteStatement;
  exec(sql: string): void;
  pragma(pragma: string, opts?: { simple?: boolean }): unknown;
  close(): void;
}

type BetterSqliteCtor = new (
  filename: string,
  opts?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number },
) => BetterSqliteDatabase;

const loadBetterSqlite3 = (): BetterSqliteCtor => {
  try {
    return require_('better-sqlite3') as BetterSqliteCtor;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[auth:sqlite] failed to load 'better-sqlite3'. Run \`npm install better-sqlite3\` ` +
        `to install the native module, or set STORAGE_KIND=memory to skip SQLite. ` +
        `Underlying error: ${detail}`,
    );
  }
};

export interface SqliteAccountsStoreOptions {
  /** Path to the SQLite database file. `':memory:'` for ephemeral tests.
   * Defaults to `'./bgio-data/settlement.sqlite'` so it lines up with
   * the bgio match-storage adapter's default. Parent directory is
   * created if missing. */
  path?: string;
  /** Override migrations dir (tests). Defaults to
   * `server/storage/migrations` so the schema this store depends on
   * lands automatically. */
  migrationsDir?: string;
}

const DEFAULT_DB_PATH = './bgio-data/settlement.sqlite';

const DEFAULT_MIGRATIONS_DIR = (() => {
  const here = dirname(fileURLToPath(import.meta.url));
  // server/auth → server/storage/migrations
  return resolve(here, '..', 'storage', 'migrations');
})();

/** Run all `*.sql` files in `migrationsDir` in numbered order against `db`.
 * Idempotent: every file uses `IF NOT EXISTS`. */
const runMigrations = (db: BetterSqliteDatabase, migrationsDir: string): void => {
  if (!existsSync(migrationsDir)) return;
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
};

interface UserDbRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

interface TokenDbRow {
  user_id: string;
  issued_at: number;
  expires_at: number;
}

const userRowToAccount = (row: UserDbRow): AccountUserRow => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
});

const tokenRowToAccount = (row: TokenDbRow): AccountTokenRow => ({
  userID: row.user_id,
  issuedAt: row.issued_at,
  expiresAt: row.expires_at,
});

export const createSqliteAccountsStore = (
  opts: SqliteAccountsStoreOptions = {},
): AccountsStore => {
  const Ctor = loadBetterSqlite3();
  const dbPath = opts.path ?? DEFAULT_DB_PATH;

  if (dbPath !== ':memory:') {
    const resolved = isAbsolute(dbPath) ? dbPath : resolve(dbPath);
    const parent = dirname(resolved);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  }

  const db = new Ctor(dbPath);
  // WAL is the bgio adapter's default too; safe to repeat. No-op on `:memory:`.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, opts.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);

  const stmts = {
    findUserByLower: db.prepare(
      // NOCASE collation on the username column makes this case-insensitive.
      `SELECT id, username, password_hash, created_at FROM users WHERE username = ? LIMIT 1`,
    ),
    findUserById: db.prepare(
      `SELECT id, username, password_hash, created_at FROM users WHERE id = ? LIMIT 1`,
    ),
    insertUser: db.prepare(
      `INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
    ),
    findToken: db.prepare(
      `SELECT user_id, issued_at, expires_at FROM auth_tokens WHERE token = ? LIMIT 1`,
    ),
    insertToken: db.prepare(
      `INSERT OR REPLACE INTO auth_tokens (token, user_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`,
    ),
    deleteToken: db.prepare(`DELETE FROM auth_tokens WHERE token = ?`),
    backdateToken: db.prepare(
      `UPDATE auth_tokens SET issued_at = issued_at - ?, expires_at = expires_at - ? WHERE token = ?`,
    ),
    deleteAllUsers: db.prepare(`DELETE FROM users`),
    deleteAllTokens: db.prepare(`DELETE FROM auth_tokens`),
  };

  return {
    findUserByLower(lower) {
      // NOCASE means we can pass the original case OR the lowercase form.
      // Callers pass lower for parity with the in-memory store.
      const row = stmts.findUserByLower.get(lower) as UserDbRow | undefined;
      return row ? userRowToAccount(row) : undefined;
    },
    findUserById(id) {
      const row = stmts.findUserById.get(id) as UserDbRow | undefined;
      return row ? userRowToAccount(row) : undefined;
    },
    insertUser(row) {
      try {
        stmts.insertUser.run(row.id, row.username, row.passwordHash, row.createdAt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // SQLite unique-constraint failure → match the in-memory store's
        // error message so the upstream /auth/register handler returns
        // the same 400 body.
        if (msg.toLowerCase().includes('unique')) {
          throw new Error('username already taken');
        }
        throw err;
      }
    },
    findToken(token) {
      const row = stmts.findToken.get(token) as TokenDbRow | undefined;
      return row ? tokenRowToAccount(row) : undefined;
    },
    insertToken(token, row) {
      stmts.insertToken.run(token, row.userID, row.issuedAt, row.expiresAt);
    },
    deleteToken(token) {
      stmts.deleteToken.run(token);
    },
    clear() {
      // Tokens first (FK to users), then users.
      stmts.deleteAllTokens.run();
      stmts.deleteAllUsers.run();
    },
    backdateToken(token, ageMs) {
      const result = stmts.backdateToken.run(ageMs, ageMs, token);
      return result.changes > 0;
    },
  };
};
