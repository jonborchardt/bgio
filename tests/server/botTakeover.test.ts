// @vitest-environment node
//
// Issue 003 — end-to-end bot-takeover smoke. Implements the four
// `it.todo` lines under "idleWatcher — integration with createServer"
// in `tests/server/idle.test.ts`.
//
// Strategy: spin up `createServer` against the in-memory storage
// (no SQLite native dep needed), POST to /games/settlement/create
// to mint a real match with real `state` + `metadata`, then drive
// the seat-takeover + bot-driver path directly. We don't open
// SocketIO connections — the bot driver doesn't need one to
// dispatch through `Master.onUpdate` against the shared storage.

import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type CreatedServer } from '../../server/index.ts';
import { grantBotControl, revokeBotControl } from '../../server/idle/seatTakeover.ts';

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanup.length) {
    const fn = cleanup.pop();
    try {
      await fn?.();
    } catch {
      /* ignore */
    }
  }
});

interface BgioMatchData {
  state?: {
    _stateID: number;
    ctx: { gameover?: unknown };
  };
  metadata?: {
    players?: Record<
      string,
      { isBot?: boolean; credentials?: string } | undefined
    >;
  };
}

const bootServer = async (): Promise<{
  created: CreatedServer;
  port: number;
}> => {
  const created = createServer({ port: 0, storage: 'memory' });
  const port = await created.start(0);
  cleanup.push(async () => {
    created.botDriver.stop();
    created.idleWatcher.stop();
    const s = created.server as unknown as {
      appServer?: { close?: (cb?: () => void) => void };
      apiServer?: { close?: (cb?: () => void) => void };
    };
    await Promise.all([
      new Promise<void>((r) =>
        s.appServer?.close ? s.appServer.close(() => r()) : r(),
      ),
      new Promise<void>((r) =>
        s.apiServer?.close ? s.apiServer.close(() => r()) : r(),
      ),
    ]);
  });
  return { created, port };
};

const createMatch = async (
  port: number,
  numPlayers: number,
): Promise<string> => {
  const r = await fetch(
    `http://127.0.0.1:${port}/games/settlement/create`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ numPlayers }),
    },
  );
  expect(r.ok).toBe(true);
  const body = (await r.json()) as { matchID: string };
  return body.matchID;
};

const fetchMatch = async (
  created: CreatedServer,
  matchID: string,
): Promise<BgioMatchData> => {
  // bgio's Server.db duck-types as `Async`; we narrow to the methods
  // we care about. The in-memory adapter's `fetch` is synchronous in
  // shape but typed as Promise — `await Promise.resolve()` covers
  // either case.
  const db = (created.server as unknown as { db: BgioMatchData['state'] }).db as unknown as {
    fetch: (
      id: string,
      opts: { state?: boolean; metadata?: boolean },
    ) => BgioMatchData | Promise<BgioMatchData>;
  };
  return Promise.resolve(db.fetch(matchID, { state: true, metadata: true }));
};

describe('idleWatcher — integration with createServer (issue 003)', () => {
  it('createServer exposes idleWatcher + botDriver on the handle', () => {
    const created = createServer({ port: 0, storage: 'memory' });
    cleanup.push(() => {
      created.botDriver.stop();
      created.idleWatcher.stop();
    });
    expect(typeof created.idleWatcher.start).toBe('function');
    expect(typeof created.idleWatcher.stop).toBe('function');
    expect(typeof created.idleWatcher.noteActivity).toBe('function');
    expect(typeof created.botDriver.start).toBe('function');
    expect(typeof created.botDriver.__tickNow).toBe('function');
  });

  it('a 2p match: marking seat 0 as bot makes the bot driver dispatch its move', async () => {
    const { created, port } = await bootServer();
    const matchID = await createMatch(port, 2);

    // Stop the live timer; use a deterministic picker so the bot
    // always lands on the first enumerator candidate (chiefDistribute
    // for seat 0 in chiefPhase). Other candidates may INVALID_MOVE
    // depending on state — we just need ONE applied move to prove
    // the dispatch path works.
    created.botDriver.stop();
    const { makeBotDriver } = await import('../../server/bots/botDriver.ts');
    const driver = makeBotDriver({
      server: created.server as unknown as Parameters<
        typeof makeBotDriver
      >[0]['server'],
      intervalMs: 0,
      pickIndex: () => 0,
    });

    // Confirm metadata + state landed.
    const before = await fetchMatch(created, matchID);
    expect(before.metadata?.players?.['0']).toBeDefined();
    expect(before.state?._stateID).toBe(0);
    expect(before.metadata?.players?.['0']?.isBot).toBeFalsy();

    // Hand seat 0 to a bot. (In production the idleWatcher does this
    // after IDLE_TIMEOUT_MS; here we fire it directly.)
    await grantBotControl(
      created.server as unknown as Parameters<typeof grantBotControl>[0],
      matchID,
      '0',
    );

    const afterGrant = await fetchMatch(created, matchID);
    expect(afterGrant.metadata?.players?.['0']?.isBot).toBe(true);

    await driver.__tickNow();

    const afterTick = await fetchMatch(created, matchID);
    // _stateID monotonically increases per applied move.
    expect(afterTick.state?._stateID ?? 0).toBeGreaterThan(0);
  });

  it('reconnect: revoking bot control stops further bot dispatches', async () => {
    const { created, port } = await bootServer();
    const matchID = await createMatch(port, 2);
    created.botDriver.stop();
    const { makeBotDriver } = await import('../../server/bots/botDriver.ts');
    const driver = makeBotDriver({
      server: created.server as unknown as Parameters<
        typeof makeBotDriver
      >[0]['server'],
      intervalMs: 0,
      pickIndex: () => 0,
    });

    // Grant, tick once, then revoke and tick again. _stateID should
    // advance during the granted window and stay put after revoke.
    await grantBotControl(
      created.server as unknown as Parameters<typeof grantBotControl>[0],
      matchID,
      '0',
    );
    await driver.__tickNow();
    const afterFirstTick = (await fetchMatch(created, matchID)).state?._stateID ?? 0;
    expect(afterFirstTick).toBeGreaterThan(0);

    await revokeBotControl(
      created.server as unknown as Parameters<typeof revokeBotControl>[0],
      matchID,
      '0',
    );
    const afterRevoke = await fetchMatch(created, matchID);
    expect(afterRevoke.metadata?.players?.['0']?.isBot).toBe(false);

    // Now ticks must NOT advance state — no seat is flagged bot.
    await driver.__tickNow();
    await driver.__tickNow();
    const afterSecondTick = (await fetchMatch(created, matchID)).state?._stateID ?? 0;
    expect(afterSecondTick).toBe(afterFirstTick);
  });

  it('does not fire takeover for a seat that just registered activity', async () => {
    const { created, port } = await bootServer();
    const matchID = await createMatch(port, 2);
    const watcher = created.idleWatcher;

    // Seat '0' just acted (fresh activity). Seat '1' is idle.
    watcher.noteActivity(matchID, '0');
    // Make seat '1' look idle by writing an old timestamp directly.
    const table = watcher.__getLastActivity();
    if (!table.has(matchID)) table.set(matchID, new Map());
    table.get(matchID)!.set('1', Date.now() - 6 * 60 * 1000);

    await watcher.__sweepNow();
    const meta = (await fetchMatch(created, matchID)).metadata;
    // Seat 0 (active) stays human; seat 1 (idle) flips to bot.
    expect(meta?.players?.['0']?.isBot).toBeFalsy();
    expect(meta?.players?.['1']?.isBot).toBe(true);
  });
});
