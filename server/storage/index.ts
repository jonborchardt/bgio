// Storage adapter factory (10.4 / 13.3).
//
// bgio's `Server({ db })` accepts any `Async`-shaped object — that's the
// adapter contract. This file is a small switch over the kind we want
// for a given environment. We deliberately don't introduce a parallel
// `Storage` type: bgio's `Async` IS the contract.
//
// V1 ships:
//   - 'memory'   — return undefined; bgio falls back to its built-in
//                  in-memory storage. Used by `npm test` and any
//                  ephemeral boot.
//   - 'flatfile' — bgio's bundled FlatFile adapter (persisted under
//                  ./bgio-data by default). The instance is constructed
//                  lazily because FlatFile pulls in `node-persist` at
//                  construct time, and our test environment doesn't
//                  always have it installed; we fall back to memory if
//                  the import or instantiation throws.
//   - 'sqlite'   — `better-sqlite3`-backed adapter from 13.3. The native
//                  module is a runtime dep; if it's missing we log a
//                  warning and fall back to memory so dev keeps working
//                  on machines that haven't run `npm install` yet.
//
// Production deploys (Render — see render.yaml) pin
// `STORAGE_KIND=sqlite` and ensure better-sqlite3 is installed via the
// Dockerfile, so the fallback never fires there.

import { FlatFile } from 'boardgame.io/server';
import { makeSqliteStorage } from './sqlite.ts';

/** What kind of adapter to construct. */
export type StorageKind = 'memory' | 'flatfile' | 'sqlite';

export interface MakeStorageOptions {
  /** Directory for the flatfile adapter. Defaults to './bgio-data'. */
  dir?: string;
  /** Path for the SQLite database file. Defaults to
   * './bgio-data/settlement.sqlite'. Use `':memory:'` for ephemeral tests.
   * Read from `process.env.SQLITE_PATH` when called via `STORAGE_KIND` env. */
  sqlitePath?: string;
}

/** Construct a bgio storage adapter (`Async`-shaped) for the given kind.
 *
 * Returns `undefined` for `'memory'` (bgio's default in-memory store) so
 * callers can pass the result straight into `Server({ db })` without
 * branching: bgio treats an undefined `db` as "use the built-in".
 *
 * If `'flatfile'` or `'sqlite'` is requested but the underlying module
 * fails to load (e.g. native dep not built in the current environment),
 * we log a warning and fall back to memory rather than crashing the
 * boot. Production deploys should ensure the relevant dep is available
 * so this fallback never silently triggers. */
export const makeStorage = (
  kind: StorageKind = 'memory',
  opts: MakeStorageOptions = {},
): unknown => {
  if (kind === 'memory') return undefined;

  if (kind === 'flatfile') {
    try {
      // FlatFile's constructor is sync but loads `node-persist` eagerly —
      // wrap in try/catch so a missing optional dep degrades gracefully.
      return new FlatFile({ dir: opts.dir ?? './bgio-data' });
    } catch (err) {
      // Don't import a logger; this fires at boot before anything else
      // is wired up.
      console.warn(
        '[storage] FlatFile init failed, falling back to in-memory:',
        err instanceof Error ? err.message : err,
      );
      return undefined;
    }
  }

  if (kind === 'sqlite') {
    // The sqlite module loads `better-sqlite3` (a native dep) eagerly inside
    // its constructor. If the dep isn't installed we want a console warning
    // and a graceful fall-back to memory, not a crashed boot.
    try {
      return makeSqliteStorage({
        path: opts.sqlitePath ?? process.env.SQLITE_PATH,
      });
    } catch (err) {
      console.warn(
        '[storage] SQLite init failed, falling back to in-memory:',
        err instanceof Error ? err.message : err,
      );
      return undefined;
    }
  }

  // Exhaustiveness — TypeScript will surface a new kind here if we extend
  // StorageKind without updating this switch.
  const exhaustive: never = kind;
  throw new Error(`makeStorage: unknown kind '${String(exhaustive)}'`);
};
