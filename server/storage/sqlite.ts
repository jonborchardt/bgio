// 13.3 — SQLite storage adapter for bgio.
//
// Implements bgio's `Async` storage shape against `better-sqlite3`. The
// `Async` interface is the contract bgio's `Server({ db })` consumes; we
// don't import the named type because bgio doesn't export it from a stable
// path, and a structural match is enough — `new Server({ db: <this> })`
// type-checks via the `unknown` slot in `server/index.ts`.
//
// Methods (per bgio's `Async` interface):
//
//   connect() / disconnect()        — lifecycle hooks. We open the DB
//                                     eagerly in the constructor, so
//                                     connect() is a no-op.
//   createMatch(matchID, opts)      — opts has `initialState`, `metadata`.
//   setState(matchID, state, log?)  — log is an array of new entries to
//                                     append (NOT the full log).
//   fetch(matchID, opts)            — opts is a record like
//                                     { state: true, metadata: true, ... }
//                                     selecting which payloads to return.
//   wipe(matchID)                   — delete all rows for the match.
//   setMetadata(matchID, metadata)  — replace metadata only.
//   listMatches(opts?)              — return matchIDs, optionally filtered.
//
// We JSON-encode `state`, `metadata`, `setupData`, and `initialState`
// columns. WAL mode is enabled at boot so concurrent reads + writes from
// different bgio operations don't block each other.
//
// **Native dep gating.** `better-sqlite3` is a native module. To keep this
// file from blowing up TypeScript's strict typecheck on machines that
// haven't run `npm install` yet, we use `createRequire` with `ts-ignore`
// at the require site (no @types/better-sqlite3 dependency). The error
// surfaces at runtime with a clear message rather than at typecheck time.

import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `better-sqlite3` is a CommonJS module shipping its own .d.ts; we go
// through createRequire so ESM TypeScript with `verbatimModuleSyntax` doesn't
// complain about a missing default export. The cast through `unknown` keeps
// us honest: callers should treat it as opaque, and we declare just enough
// of the surface we actually use below.
const require_ = createRequire(import.meta.url);

interface BetterSqliteStatement {
  run(...args: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface BetterSqliteDatabase {
  prepare(sql: string): BetterSqliteStatement;
  exec(sql: string): void;
  pragma(pragma: string, opts?: { simple?: boolean }): unknown;
  close(): void;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
}

type BetterSqliteCtor = new (
  filename: string,
  opts?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number },
) => BetterSqliteDatabase;

const loadBetterSqlite3 = (): BetterSqliteCtor => {
  try {
    const mod = require_('better-sqlite3') as BetterSqliteCtor;
    return mod;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[storage:sqlite] failed to load 'better-sqlite3'. Run \`npm install better-sqlite3\` ` +
        `to install the native module, or set STORAGE_KIND=memory / flatfile to skip SQLite. ` +
        `Underlying error: ${detail}`,
    );
  }
};

export interface SqliteStorageOptions {
  /** Path to the SQLite database file. Use `':memory:'` for ephemeral tests.
   * Defaults to `'./bgio-data/settlement.sqlite'`. Parent directory is
   * created if missing. */
  path?: string;
  /** Override the migrations directory. Defaults to `./migrations` next to
   * this file. Tests use this to point at a fixture set when needed. */
  migrationsDir?: string;
}

/** `bgio` storage method options (we describe only the subset we need;
 * any additional keys bgio passes through are ignored gracefully). */
interface FetchOpts {
  state?: boolean;
  log?: boolean;
  metadata?: boolean;
  initialState?: boolean;
}

interface FetchResult {
  state?: unknown;
  log?: unknown[];
  metadata?: unknown;
  initialState?: unknown;
}

interface CreateMatchOpts {
  initialState: unknown;
  metadata: unknown;
}

interface ListMatchesOpts {
  gameName?: string;
  where?: { isGameover?: boolean; updatedBefore?: number; updatedAfter?: number };
}

/** Run all `*.sql` files in `migrationsDir` in numbered order against `db`.
 * Migrations are expected to be idempotent — we don't track applied
 * versions because every file uses `IF NOT EXISTS`. */
const runMigrations = (db: BetterSqliteDatabase, migrationsDir: string): void => {
  if (!existsSync(migrationsDir)) {
    // No migrations dir — adapter is still functional (caller may have
    // pre-populated the DB), so we don't throw.
    return;
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec(sql);
  }
};

const DEFAULT_MIGRATIONS_DIR = (() => {
  // ESM equivalent of __dirname.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'migrations');
})();

const DEFAULT_DB_PATH = './bgio-data/settlement.sqlite';

/** Construct a SQLite storage adapter implementing bgio's `Async` shape. */
export class SqliteStorage {
  private readonly db: BetterSqliteDatabase;
  private readonly stmts: {
    insertMatch: BetterSqliteStatement;
    updateState: BetterSqliteStatement;
    updateMetadata: BetterSqliteStatement;
    selectMatch: BetterSqliteStatement;
    deleteMatch: BetterSqliteStatement;
    deleteLog: BetterSqliteStatement;
    insertLogEntry: BetterSqliteStatement;
    nextLogIdx: BetterSqliteStatement;
    selectLog: BetterSqliteStatement;
    listMatchIDs: BetterSqliteStatement;
  };

  constructor(opts: SqliteStorageOptions = {}) {
    const Ctor = loadBetterSqlite3();
    const dbPath = opts.path ?? DEFAULT_DB_PATH;

    if (dbPath !== ':memory:' && !isAbsolute(dbPath)) {
      // Resolve relative to cwd so the file is predictable.
      const resolved = resolve(dbPath);
      const parent = dirname(resolved);
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    } else if (dbPath !== ':memory:') {
      const parent = dirname(dbPath);
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    }

    this.db = new Ctor(dbPath);

    // WAL for concurrent readers. `journal_mode = WAL` is a no-op for
    // ':memory:' but doesn't error.
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    runMigrations(this.db, opts.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);

    // Prepare the hot-path statements once. better-sqlite3 caches plans
    // per-statement so this is the recommended pattern.
    this.stmts = {
      insertMatch: this.db.prepare(
        `INSERT INTO matches (id, setup_data, metadata, state, initial_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           setup_data=excluded.setup_data,
           metadata=excluded.metadata,
           state=excluded.state,
           initial_state=excluded.initial_state,
           updated_at=excluded.updated_at`,
      ),
      updateState: this.db.prepare(
        `UPDATE matches SET state = ?, updated_at = ? WHERE id = ?`,
      ),
      updateMetadata: this.db.prepare(
        `UPDATE matches SET metadata = ?, updated_at = ? WHERE id = ?`,
      ),
      selectMatch: this.db.prepare(
        `SELECT id, setup_data, metadata, state, initial_state FROM matches WHERE id = ?`,
      ),
      deleteMatch: this.db.prepare(`DELETE FROM matches WHERE id = ?`),
      deleteLog: this.db.prepare(`DELETE FROM log WHERE match_id = ?`),
      // Plain INSERT (not INSERT OR REPLACE) so an idx collision fails
      // loudly instead of silently overwriting an earlier log row.
      // Combined with the MAX-based nextIdx query below this is also
      // O(1) per append rather than O(n) the prior SELECT-and-count was.
      insertLogEntry: this.db.prepare(
        `INSERT INTO log (match_id, idx, entry) VALUES (?, ?, ?)`,
      ),
      nextLogIdx: this.db.prepare(
        `SELECT COALESCE(MAX(idx), -1) + 1 AS next FROM log WHERE match_id = ?`,
      ),
      selectLog: this.db.prepare(
        `SELECT entry FROM log WHERE match_id = ? ORDER BY idx ASC`,
      ),
      listMatchIDs: this.db.prepare(`SELECT id FROM matches ORDER BY updated_at DESC`),
    };
  }

  /** bgio lifecycle hook. We open eagerly so this is a no-op; bgio always
   * awaits the result anyway. */
  async connect(): Promise<void> {
    return;
  }

  /** Best-effort close. Tests that share a DB across cases call this. */
  async disconnect(): Promise<void> {
    try {
      this.db.close();
    } catch {
      // Ignore — closing twice is a noop.
    }
  }

  async createMatch(matchID: string, opts: CreateMatchOpts): Promise<void> {
    const now = Date.now();
    const metadata = (opts.metadata ?? {}) as Record<string, unknown>;
    const setupData = (metadata as { setupData?: unknown }).setupData ?? null;
    this.stmts.insertMatch.run(
      matchID,
      JSON.stringify(setupData),
      JSON.stringify(opts.metadata),
      JSON.stringify(opts.initialState),
      JSON.stringify(opts.initialState),
      now,
      now,
    );
  }

  async setState(
    matchID: string,
    state: unknown,
    deltalog?: unknown[],
  ): Promise<void> {
    const now = Date.now();
    // We wrap the state update + log append in a single transaction so an
    // interrupted write can't leave a half-written log behind.
    const apply = this.db.transaction((s: unknown, log: unknown[] | undefined) => {
      this.stmts.updateState.run(JSON.stringify(s), now, matchID);
      if (log && log.length > 0) {
        // bgio passes the *new* log entries each call. We compute the
        // next free idx via MAX(idx)+1 inside the same transaction so
        // a concurrent setState (better-sqlite3 is sync per
        // connection, but transactions interleave across connections)
        // can't collide. The earlier implementation was
        // SELECT-and-count of the entire log per call (O(n) per
        // append → O(n²) over a match) combined with INSERT OR
        // REPLACE which silently overwrote any clash.
        const row = this.stmts.nextLogIdx.get(matchID) as { next: number };
        let nextIdx = row.next;
        for (let i = 0; i < log.length; i += 1) {
          this.stmts.insertLogEntry.run(
            matchID,
            nextIdx,
            JSON.stringify(log[i]),
          );
          nextIdx += 1;
        }
      }
    });
    apply(state, deltalog);
  }

  async setMetadata(matchID: string, metadata: unknown): Promise<void> {
    this.stmts.updateMetadata.run(JSON.stringify(metadata), Date.now(), matchID);
  }

  async fetch(matchID: string, opts: FetchOpts): Promise<FetchResult> {
    const row = this.stmts.selectMatch.get(matchID) as
      | {
          id: string;
          setup_data: string;
          metadata: string;
          state: string;
          initial_state: string | null;
        }
      | undefined;
    const out: FetchResult = {};
    if (!row) return out;
    if (opts.state) out.state = JSON.parse(row.state);
    if (opts.metadata) out.metadata = JSON.parse(row.metadata);
    if (opts.initialState && row.initial_state !== null) {
      out.initialState = JSON.parse(row.initial_state);
    }
    if (opts.log) {
      const rows = this.stmts.selectLog.all(matchID) as { entry: string }[];
      out.log = rows.map((r) => JSON.parse(r.entry) as unknown);
    }
    return out;
  }

  async wipe(matchID: string): Promise<void> {
    // FK ON DELETE CASCADE handles `log`, but we delete explicitly in case
    // future schemas drop the cascade.
    const wipeAll = this.db.transaction((id: string) => {
      this.stmts.deleteLog.run(id);
      this.stmts.deleteMatch.run(id);
    });
    wipeAll(matchID);
  }

  async listMatches(_opts?: ListMatchesOpts): Promise<string[]> {
    // V1 ignores the filter args — bgio uses listMatches mostly for the
    // lobby's "list all open matches" call which we surface unfiltered.
    // The arg is named `_opts` to silence noUnusedParameters.
    void _opts;
    const rows = this.stmts.listMatchIDs.all() as { id: string }[];
    return rows.map((r) => r.id);
  }
}

/** Convenience: build an `Async`-shaped instance. Returned as `unknown` so
 * callers route it through the same `unknown`-typed `db` slot used for
 * bgio's other adapters. */
export const makeSqliteStorage = (opts: SqliteStorageOptions = {}): unknown => {
  return new SqliteStorage(opts);
};
