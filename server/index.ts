// Bgio Koa server bootstrap.
//
// This file is consumed by Node (via `tsx` for dev or `tsc` for build), not by
// Vite. It hosts the same `Settlement` Game definition the React client
// imports — boardgame.io's `Server` accepts a list of games, and the rest
// (lobby REST endpoints, sockets, storage) is plumbed by the bgio core. Per
// CLAUDE.md the rule is: lean on the bgio export rather than rolling our own
// server, and only layer thin glue on top.
//
// 10.4 will swap the storage adapter (FlatFile for now, possibly a real DB
// later); 13.2 takes over the deploy story. This file is intentionally small
// so those follow-ups can edit just the relevant seam.

import { Server } from 'boardgame.io/server';
import { Settlement } from '../src/game/index.ts';

/** Result of `createServer` — exposes the bgio Server instance plus a
 * `port` Promise that resolves once the underlying Koa app is listening.
 * Tests use this to learn the port assigned by the OS when `port: 0`.
 */
export interface CreatedServer {
  /** The raw bgio `Server` instance. Call `.run(port)` to start it. */
  server: ReturnType<typeof Server>;
  /** Convenience wrapper: starts the server and resolves with the port. */
  start: (port?: number) => Promise<number>;
}

export interface CreateServerOptions {
  /** TCP port. Defaults to `PORT` env var or 8000. Pass 0 to let the OS pick. */
  port?: number;
  /** Storage adapter (an `Async`-shaped object). Default = bgio in-memory. */
  storage?: unknown;
}

/**
 * Construct a bgio Server hosting the `Settlement` game.
 *
 * We accept `storage` as an opaque `unknown` because the bgio `Async` /
 * `Sync` storage interfaces aren't exported as standalone types from the
 * top-level `boardgame.io/server` entry; passing one through is enough.
 */
export const createServer = (opts: CreateServerOptions = {}): CreatedServer => {
  const serverConfig: { games: typeof Settlement[]; db?: unknown } = {
    games: [Settlement],
  };
  if (opts.storage !== undefined) {
    serverConfig.db = opts.storage;
  }

  // bgio's Server() accepts `{ games, db?, ... }`. The default storage is
  // in-memory, which is fine for V1 boot and matches the plan note that
  // FlatFile / real adapters land in 10.4.
  const server = Server(serverConfig as Parameters<typeof Server>[0]);

  const start = async (port?: number): Promise<number> => {
    const requestedPort =
      port ?? opts.port ?? Number(process.env.PORT ?? '8000');
    // bgio's `run` returns `{ apiServer, appServer }`; both are http.Server.
    // We grab `appServer.address().port` because passing `0` triggers an OS
    // assignment we want to surface to the caller.
    const running = (await (server.run as unknown as (p: number) => Promise<{
      appServer: { address: () => { port: number } | string | null };
    }>)(requestedPort));
    const addr = running.appServer.address();
    if (addr && typeof addr === 'object' && 'port' in addr) {
      return addr.port;
    }
    return requestedPort;
  };

  return { server, start };
};

// CLI entrypoint. We compare argv[1] to this module's path so the bootstrap
// only fires when this file is invoked directly (e.g. `tsx server/index.ts`),
// not when imported from a test. `import.meta.url` is a `file://` URL; we
// build the same URL from `process.argv[1]` for comparison and tolerate
// either a script path or a URL there.
const isDirectInvocation = (() => {
  if (typeof process === 'undefined' || !process.argv?.[1]) return false;
  const argvUrl = process.argv[1].startsWith('file:')
    ? process.argv[1]
    : `file://${process.argv[1].replace(/\\/g, '/')}`;
  return import.meta.url === argvUrl;
})();

if (isDirectInvocation) {
  const port = Number(process.env.PORT ?? '8000');
  void createServer({ port }).start(port);
}
