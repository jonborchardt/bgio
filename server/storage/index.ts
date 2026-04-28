// Storage adapter factory (10.4).
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
//
// SQLite is deferred to 13.3 — it would need `better-sqlite3` (a native
// dependency) and the plan explicitly says "if we ever need 'em". The
// production deploy target hasn't been picked yet; adding native deps
// here in V1 would be premature.

import { FlatFile } from 'boardgame.io/server';

/** What kind of adapter to construct. Extend with `'sqlite'` / `'postgres'`
 * in 13.3 once a deploy target is chosen. */
export type StorageKind = 'memory' | 'flatfile';

export interface MakeStorageOptions {
  /** Directory for the flatfile adapter. Defaults to './bgio-data'. */
  dir?: string;
}

/** Construct a bgio storage adapter (`Async`-shaped) for the given kind.
 *
 * Returns `undefined` for `'memory'` (bgio's default in-memory store) so
 * callers can pass the result straight into `Server({ db })` without
 * branching: bgio treats an undefined `db` as "use the built-in".
 *
 * If `'flatfile'` is requested but FlatFile fails to construct (e.g.
 * `node-persist` isn't installed in the current environment), we log a
 * warning and fall back to memory rather than crashing the boot — this
 * keeps tests + dev servers running on machines without the optional
 * persistence dep. Production deploys should ensure `node-persist` is
 * available so this fallback never silently triggers. */
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

  // Exhaustiveness — TypeScript will surface an `'sqlite'` branch here
  // once StorageKind grows.
  const exhaustive: never = kind;
  throw new Error(`makeStorage: unknown kind '${String(exhaustive)}'`);
};
