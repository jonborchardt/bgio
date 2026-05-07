// Issue 022 — shared SQLite migration runner.
//
// Both the bgio match adapter (`./sqlite.ts`) and the auth / runs
// stores open their own better-sqlite3 connection to the same DB
// file. Each used to run every `migrations/*.sql` file blindly on
// connect — fine while every statement is `IF NOT EXISTS`, but the
// moment someone authors a non-idempotent migration (e.g. ALTER
// TABLE) the second-and-later boots throw, and concurrent boots of
// the two stores race on the same file.
//
// This module installs:
//   1. A `_migrations` ledger table recording which files have been
//      applied (filename + epoch ms when applied).
//   2. A short `BEGIN EXCLUSIVE` window around the apply loop so two
//      connections opening at the same time can't both apply the
//      same migration. EXCLUSIVE upgrades the connection's lock so
//      a sibling boot waits until we're done; the second boot's
//      ledger lookup then sees the freshly-applied row and skips.
//   3. A single `runMigrations(db, dir)` entry point both stores
//      call so the order + ledger contract stays in lockstep.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

interface BetterSqliteStatement {
  run(...args: unknown[]): unknown;
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface BetterSqliteDatabase {
  prepare(sql: string): BetterSqliteStatement;
  exec(sql: string): void;
}

const MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

/** Apply every `*.sql` file in `dir` (sorted by filename) once. */
export const runMigrations = (
  db: BetterSqliteDatabase,
  dir: string,
): void => {
  if (!existsSync(dir)) return;
  db.exec(MIGRATIONS_TABLE_DDL);

  // Pull the list of applied filenames once before we acquire the
  // exclusive lock — keeps the lock window short. Any racing peer
  // applying additional rows between this read and our actual apply
  // is handled because the apply loop re-checks each filename
  // inside the transaction.
  const applied = new Set<string>();
  const rows = db
    .prepare(`SELECT filename FROM _migrations`)
    .all() as Array<{ filename: string }>;
  for (const r of rows) applied.add(r.filename);

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) return;

  const recordStmt = db.prepare(
    `INSERT OR IGNORE INTO _migrations (filename, applied_at) VALUES (?, ?)`,
  );
  const checkStmt = db.prepare(
    `SELECT 1 FROM _migrations WHERE filename = ? LIMIT 1`,
  );

  // Exclusive transaction so a sibling connection waits until we're
  // done. Each migration is applied + recorded inside one logical
  // unit — if anything throws we roll back rather than leaving a
  // partially-applied schema.
  db.exec('BEGIN EXCLUSIVE');
  try {
    for (const file of pending) {
      // Re-check inside the txn; a sibling connection may have raced
      // ahead and committed the row between our list and our lock.
      if (checkStmt.get(file) !== undefined) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      db.exec(sql);
      recordStmt.run(file, Date.now());
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};
