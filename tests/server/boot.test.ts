// @vitest-environment node
//
// Server boot smoke tests.
//
// We override the test environment to `node` for this file because the
// default jsdom env wraps fetch / network in browser-shaped polyfills, and
// we want to talk to a real Koa server over a real ephemeral port. bgio's
// `Server` is built on Koa and binds to a TCP socket — there's nothing
// browser-y to simulate here.

import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../../server/index.ts';

interface RunningServerHandle {
  /** Closes both apiServer and appServer if they were assigned. */
  close: () => Promise<void>;
}

const cleanup: RunningServerHandle[] = [];

afterEach(async () => {
  while (cleanup.length) {
    const handle = cleanup.pop();
    if (handle) await handle.close().catch(() => {});
  }
});

describe('server boot', () => {
  it('createServer({ port: 0 }) boots and reports a listening port', async () => {
    const created = createServer({ port: 0 });
    const port = await created.start(0);

    // Track the underlying servers for cleanup. bgio stashes them on the
    // Server instance after `run()` resolves.
    cleanup.push({
      close: async () => {
        const s = created.server as unknown as {
          appServer?: { close?: (cb?: () => void) => void };
          apiServer?: { close?: (cb?: () => void) => void };
        };
        await Promise.all([
          new Promise<void>((res) =>
            s.appServer?.close ? s.appServer.close(() => res()) : res(),
          ),
          new Promise<void>((res) =>
            s.apiServer?.close ? s.apiServer.close(() => res()) : res(),
          ),
        ]);
      },
    });

    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
  });

  it('hitting /games/settlement/create returns a match ID', async () => {
    const created = createServer({ port: 0 });
    const port = await created.start(0);

    cleanup.push({
      close: async () => {
        const s = created.server as unknown as {
          appServer?: { close?: (cb?: () => void) => void };
          apiServer?: { close?: (cb?: () => void) => void };
        };
        await Promise.all([
          new Promise<void>((res) =>
            s.appServer?.close ? s.appServer.close(() => res()) : res(),
          ),
          new Promise<void>((res) =>
            s.apiServer?.close ? s.apiServer.close(() => res()) : res(),
          ),
        ]);
      },
    });

    const response = await fetch(
      `http://127.0.0.1:${port}/games/settlement/create`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numPlayers: 2 }),
      },
    );

    expect(response.ok).toBe(true);
    const body = (await response.json()) as { matchID?: string };
    expect(typeof body.matchID).toBe('string');
    expect(body.matchID!.length).toBeGreaterThan(0);
  });
});
