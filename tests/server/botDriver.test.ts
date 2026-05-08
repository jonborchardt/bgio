// Issue 003 — coverage for the server-side bot driver.
//
// We don't spin a full bgio Server; instead we hand `makeBotDriver` a
// stub `server` shape with an in-memory `db`, a stub `auth`, and a
// stub `pubSub`, and drive `__tickNow()` manually. That exercises the
// listMatches → fetch → enumerate → master.onUpdate path without
// requiring a SocketIO socket.

import { describe, expect, it, vi } from 'vitest';
import { makeBotDriver } from '../../server/bots/botDriver.ts';
import { scienceBot } from '../../src/game/ai/scienceBot.ts';

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

  it("solo mode: marks every non-human seat as a bot via setMetadata", async () => {
    // Use a Map-backed fake storage so setMetadata writes are visible
    // to subsequent fetches (grantBotControl re-fetches on every call).
    const matches = new Map<
      string,
      {
        state: unknown;
        metadata: { players: Record<string, { isBot?: boolean } | undefined> };
      }
    >();
    matches.set('m1', {
      state: {
        // 4-player solo where the human plays chief. assignRoles(4) puts
        // chief on seat 0; seats 1–3 are non-human.
        G: { _setup: { soloMode: true, humanRole: 'chief' } },
        ctx: {
          // currentPlayer 0 means the chief is "active". Bots on
          // seats 1–3 won't dispatch this tick (none of them is the
          // active seat) — but they MUST be flagged so the next
          // chief→others phase boundary lets them act.
          currentPlayer: '0',
          activePlayers: null,
        },
        _stateID: 0,
      },
      metadata: {
        players: {
          '0': {},
          '1': {},
          '2': {},
          '3': {},
        },
      },
    });

    const db = {
      listMatches: () => Array.from(matches.keys()),
      fetch: async (
        matchID: string,
        opts: { state?: boolean; metadata?: boolean },
      ) => {
        const m = matches.get(matchID);
        if (!m) return {};
        return {
          state: opts.state ? m.state : undefined,
          metadata: opts.metadata ? m.metadata : undefined,
        };
      },
      setMetadata: async (
        matchID: string,
        metadata: { players: Record<string, { isBot?: boolean } | undefined> },
      ) => {
        const m = matches.get(matchID);
        if (m) m.metadata = metadata;
      },
    };

    const driver = makeBotDriver({
      server: {
        db: db as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    await driver.__tickNow();

    const players = matches.get('m1')!.metadata.players;
    const botSeats = Object.entries(players)
      .filter(([, p]) => p?.isBot === true)
      .map(([s]) => s);
    expect(botSeats.sort()).toEqual(['1', '2', '3']);
    // The human seat must NOT be flagged.
    expect(players['0']?.isBot).not.toBe(true);
  });

  it("solo mode: revokes bot flag when a human joins a previously-bot seat", async () => {
    // Reproduces the bug seen in production: user creates a solo match
    // (seat 0 = human chief), bot driver flags seats 1–3 as bots. A
    // friend joins seat 1 anyway via the lobby, setting name='jon2'.
    // Without revoking the bot flag, the auth hook only accepts the
    // synthetic `bot:1` credential and rejects the human's credentials,
    // leaving the new player stuck on bgio's "connecting…" screen.
    const matches = new Map<
      string,
      {
        state: unknown;
        metadata: {
          players: Record<
            string,
            { isBot?: boolean; name?: string } | undefined
          >;
        };
      }
    >();
    matches.set('m1', {
      state: {
        G: { _setup: { soloMode: true, humanRole: 'chief' } },
        ctx: { currentPlayer: '0', activePlayers: null },
        _stateID: 0,
      },
      metadata: {
        players: {
          '0': { name: 'jon' }, // human chief
          '1': { name: 'jon2', isBot: true }, // human took the seat — bot flag is stale
          '2': { isBot: true }, // still bot — nobody there
          '3': { isBot: true },
        },
      },
    });

    const db = {
      listMatches: () => Array.from(matches.keys()),
      fetch: async (
        matchID: string,
        opts: { state?: boolean; metadata?: boolean },
      ) => {
        const m = matches.get(matchID);
        if (!m) return {};
        return {
          state: opts.state ? m.state : undefined,
          metadata: opts.metadata ? m.metadata : undefined,
        };
      },
      setMetadata: async (
        matchID: string,
        metadata: { players: Record<string, { isBot?: boolean } | undefined> },
      ) => {
        const m = matches.get(matchID);
        if (m) m.metadata = metadata;
      },
    };

    const driver = makeBotDriver({
      server: {
        db: db as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    await driver.__tickNow();

    const players = matches.get('m1')!.metadata.players;
    // Seat 0 is the human chief — never a bot.
    expect(players['0']?.isBot).not.toBe(true);
    // Seat 1 had the stale bot flag; the human joined → flag revoked.
    expect(players['1']?.isBot).toBe(false);
    // Seats 2 and 3 still have nobody — bot flag stays.
    expect(players['2']?.isBot).toBe(true);
    expect(players['3']?.isBot).toBe(true);
  });

  it("smart-bot dispatch: consults the per-role bot before enumerate", async () => {
    // The bug: bot driver picks uniformly at random across enumerate's
    // candidate list. For a science seat with N library cards that's
    // N burn candidates vs ~1 seatDone, so the bot just burns the
    // whole row before randomly picking seatDone. Fix: ask the smart
    // per-role bot first; fall back to enumerate only if it returns
    // null.
    //
    // We verify the smart-bot path by spying on scienceBot.play. When
    // it returns a non-null candidate, the driver should dispatch
    // THAT move and NOT consult pickIndex (which only fires on the
    // enumerate fallback path).
    const playSpy = vi
      .spyOn(scienceBot, 'play')
      .mockReturnValue({ move: 'scienceLibraryBuy', args: [3] });
    const pickIndex = vi.fn().mockReturnValue(0);

    const fetched = vi.fn().mockResolvedValue({
      state: {
        G: {
          // assignRoles(2) puts science at seat 1 in 2p — the seat
          // we're testing. The smart-bot helper reads roleAssignments
          // via rolesAtSeat.
          roleAssignments: { '0': ['chief'], '1': ['science'] },
        },
        ctx: {
          phase: 'othersPhase',
          currentPlayer: '1',
          activePlayers: { '1': 'scienceTurn' },
        },
        _stateID: 0,
      },
      metadata: {
        players: { '0': { id: 0 }, '1': { id: 1, isBot: true } },
      },
    });
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
    expect(playSpy).toHaveBeenCalled();
    // pickIndex must NOT fire — the smart bot's move pre-empts the
    // enumerate-random fallback.
    expect(pickIndex).not.toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it("smart-bot dispatch: falls back to enumerate when the smart bot returns null", async () => {
    const playSpy = vi.spyOn(scienceBot, 'play').mockReturnValue(null);
    const pickIndex = vi.fn().mockReturnValue(0);

    const fetched = vi.fn().mockResolvedValue({
      state: {
        G: { roleAssignments: { '0': ['chief'], '1': ['science'] } },
        ctx: {
          phase: 'othersPhase',
          currentPlayer: '1',
          activePlayers: { '1': 'scienceTurn' },
        },
        _stateID: 0,
      },
      metadata: {
        players: { '0': { id: 0 }, '1': { id: 1, isBot: true } },
      },
    });
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
    expect(playSpy).toHaveBeenCalled();
    // Smart bot returned null → enumerate-random fallback fires →
    // pickIndex was consulted on the candidate list.
    expect(pickIndex).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it("solo mode: no-op when soloMode flag is absent", async () => {
    const setMetadataCalls: unknown[] = [];
    const fetched = vi.fn().mockResolvedValue({
      state: {
        G: { _setup: { soloMode: false } },
        ctx: { currentPlayer: '0', activePlayers: null },
        _stateID: 0,
      },
      metadata: { players: { '0': {}, '1': {}, '2': {}, '3': {} } },
    });
    const driver = makeBotDriver({
      server: {
        db: {
          listMatches: () => ['m1'],
          fetch: fetched,
          setMetadata: async (...args: unknown[]) => {
            setMetadataCalls.push(args);
          },
        } as unknown as Parameters<typeof makeBotDriver>[0]['server']['db'],
      },
    });
    await driver.__tickNow();
    // No solo flag → no metadata mutations from markSoloBotSeats.
    expect(setMetadataCalls).toHaveLength(0);
  });
});
