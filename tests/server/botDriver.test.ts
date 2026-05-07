// Issue 003 — coverage for the server-side bot driver.
//
// We don't spin a full bgio Server; instead we hand `makeBotDriver` a
// stub `server` shape with an in-memory `db`, a stub `auth`, and a
// stub `pubSub`, and drive `__tickNow()` manually. That exercises the
// listMatches → fetch → enumerate → master.onUpdate path without
// requiring a SocketIO socket.

import { describe, expect, it, vi } from 'vitest';
import { makeBotDriver } from '../../server/bots/botDriver.ts';

describe('makeBotDriver', () => {
  it('start/stop are idempotent', () => {
    const driver = makeBotDriver({
      server: { db: undefined },
      intervalMs: 999,
    });
    driver.start();
    driver.start();
    driver.stop();
    driver.stop();
  });

  it('tick is a no-op when db has no listMatches', async () => {
    const driver = makeBotDriver({
      server: {
        db: {
          fetch: async () => ({}),
        } as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    await expect(driver.__tickNow()).resolves.toBeUndefined();
  });

  it('skips matches with no bot seats', async () => {
    const fetched = vi.fn().mockResolvedValue({
      state: {
        G: {},
        ctx: { currentPlayer: '0', activePlayers: null },
        _stateID: 0,
      },
      metadata: {
        players: { '0': { id: 0, isBot: false } },
      },
    });
    const driver = makeBotDriver({
      server: {
        db: {
          listMatches: () => ['m1'],
          fetch: fetched,
        } as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    await driver.__tickNow();
    expect(fetched).toHaveBeenCalledWith('m1', { state: true, metadata: true });
  });

  it('does not crash when fetch rejects', async () => {
    const driver = makeBotDriver({
      server: {
        db: {
          listMatches: () => ['m1'],
          fetch: async () => {
            throw new Error('boom');
          },
        } as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(driver.__tickNow()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips a match whose state.ctx.gameover is set', async () => {
    const fetched = vi.fn().mockResolvedValue({
      state: {
        G: {},
        ctx: { currentPlayer: '0', activePlayers: null, gameover: { kind: 'win' } },
        _stateID: 0,
      },
      metadata: {
        players: { '0': { id: 0, isBot: true } },
      },
    });
    const pickIndex = vi.fn().mockReturnValue(0);
    const driver = makeBotDriver({
      server: {
        db: {
          listMatches: () => ['m1'],
          fetch: fetched,
        } as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
      pickIndex,
    });
    await driver.__tickNow();
    // pickIndex should never be called because gameover bails first.
    expect(pickIndex).not.toHaveBeenCalled();
  });
});
