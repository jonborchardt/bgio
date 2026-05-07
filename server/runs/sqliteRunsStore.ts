// Issue 007 — SQLite-backed RunsStore.
//
// Talks to the `runs` table created by migration `002_users_and_runs.sql`.
// Mirrors `server/auth/sqliteAccountsStore.ts`: opens its own
// better-sqlite3 connection, runs the migrations on connect (every
// statement is `IF NOT EXISTS`), and exposes the same `RunsStore`
// shape the in-memory implementation does.
//
// Native dep gating: createRequire for `better-sqlite3` so a missing
// native module surfaces at construction with a clear error rather
// than a typecheck failure on dev machines that haven't built the dep.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../storage/migrate.ts';
import type { RunRecord } from './runs.ts';
import type { RunsStore } from './runsStore.ts';

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
      `[runs:sqlite] failed to load 'better-sqlite3'. Run \`npm install better-sqlite3\` ` +
        `to install the native module, or set STORAGE_KIND=memory to skip SQLite. ` +
        `Underlying error: ${detail}`,
    );
  }
};

export interface SqliteRunsStoreOptions {
  /** Path to the SQLite database file. `':memory:'` for ephemeral tests.
   * Defaults to the same `./bgio-data/settlement.sqlite` the bgio match
   * adapter uses so a single file holds matches + accounts + runs. */
  path?: string;
  /** Override migrations dir (tests). */
  migrationsDir?: string;
}

const DEFAULT_DB_PATH = './bgio-data/settlement.sqlite';

const DEFAULT_MIGRATIONS_DIR = (() => {
  const here = dirname(fileURLToPath(import.meta.url));
  // server/runs → server/storage/migrations
  return resolve(here, '..', 'storage', 'migrations');
})();


interface RunDbRow {
  id: string;
  user_id: string;
  match_id: string;
  outcome: string;
  turns: number;
  created_at: number;
}

const rowToRun = (row: RunDbRow): RunRecord => ({
  id: row.id,
  userID: row.user_id,
  matchID: row.match_id,
  outcome: row.outcome as RunRecord['outcome'],
  turns: row.turns,
  createdAt: row.created_at,
});

export const createSqliteRunsStore = (
  opts: SqliteRunsStoreOptions = {},
): RunsStore => {
  const Ctor = loadBetterSqlite3();
  const dbPath = opts.path ?? DEFAULT_DB_PATH;

  if (dbPath !== ':memory:') {
    const resolved = isAbsolute(dbPath) ? dbPath : resolve(dbPath);
    const parent = dirname(resolved);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  }

  const db = new Ctor(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, opts.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);

  const stmts = {
    findByPair: db.prepare(
      `SELECT id, user_id, match_id, outcome, turns, created_at
         FROM runs
        WHERE match_id = ? AND user_id = ?
        LIMIT 1`,
    ),
    insert: db.prepare(
      `INSERT INTO runs (id, user_id, match_id, outcome, turns, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    listByUser: db.prepare(
      `SELECT id, user_id, match_id, outcome, turns, created_at
         FROM runs
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`,
    ),
    deleteAll: db.prepare(`DELETE FROM runs`),
  };

  return {
    insertRun(rec) {
      const existing = stmts.findByPair.get(rec.matchID, rec.userID) as
        | RunDbRow
        | undefined;
      if (existing) return rowToRun(existing);
      const created: RunRecord = {
        id: randomUUID(),
        userID: rec.userID,
        matchID: rec.matchID,
        outcome: rec.outcome,
        turns: rec.turns,
        createdAt: Date.now(),
      };
      stmts.insert.run(
        created.id,
        created.userID,
        created.matchID,
        created.outcome,
        created.turns,
        created.createdAt,
      );
      return created;
    },
    listByUser(userID) {
      const rows = stmts.listByUser.all(userID) as RunDbRow[];
      return rows.map(rowToRun);
    },
    clear() {
      stmts.deleteAll.run();
    },
    close() {
      db.close();
    },
  };
};
