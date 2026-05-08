// Plan 04 — fillEmptySeatsWithBots coverage.
//
// Tests the helper directly against a Map-backed fake storage. The
// route-level auth/CORS handling is exercised by the integration
// test in tests/server/auth.test.ts pattern when needed; the helper
// itself is the load-bearing logic and the only piece worth pinning.

import { describe, expect, it } from 'vitest';
import { fillEmptySeatsWithBots } from '../../server/lobby/fillBots.ts';

interface PlayerEntry {
  isBot?: boolean;
  name?: string;
}

interface MatchMetadata {
  players?: Record<string, PlayerEntry | undefined>;
  [k: string]: unknown;
}

const makeFakeStorage = (initial: Record<string, MatchMetadata>) => {
  const matches = new Map<string, MatchMetadata>();
  for (const [id, m] of Object.entries(initial)) matches.set(id, m);
  return {
    matches,
    db: {
      fetch: async (
        matchID: string,
        opts: { metadata?: boolean },
      ): Promise<{ metadata?: MatchMetadata }> => {
        const m = matches.get(matchID);
        if (!m) return {};
        return { metadata: opts.metadata ? m : undefined };
      },
      setMetadata: async (
        matchID: string,
        metadata: MatchMetadata,
      ): Promise<void> => {
        matches.set(matchID, metadata);
      },
    },
  };
};

describe('fillEmptySeatsWithBots (plan 04)', () => {
  it('flips every empty seat to a bot with a synthetic name', async () => {
    const fake = makeFakeStorage({
      m1: {
        players: {
          '0': { name: 'jon' },
          '1': {},
          '2': {},
          '3': {},
        },
      },
    });
    const result = await fillEmptySeatsWithBots(
      { db: fake.db } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    expect(result.filled.sort()).toEqual(['1', '2', '3']);
    const players = fake.matches.get('m1')!.players!;
    // Owner stays untouched.
    expect(players['0']?.name).toBe('jon');
    expect(players['0']?.isBot).not.toBe(true);
    // Each filled seat now has isBot=true and a synthetic name.
    expect(players['1']?.isBot).toBe(true);
    expect(players['1']?.name).toBe('Bot 2');
    expect(players['2']?.isBot).toBe(true);
    expect(players['2']?.name).toBe('Bot 3');
    expect(players['3']?.isBot).toBe(true);
    expect(players['3']?.name).toBe('Bot 4');
  });

  it('skips seats that already have a human name', async () => {
    const fake = makeFakeStorage({
      m1: {
        players: {
          '0': { name: 'jon' },
          '1': { name: 'jon2' },
          '2': {},
        },
      },
    });
    const result = await fillEmptySeatsWithBots(
      { db: fake.db } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    expect(result.filled).toEqual(['2']);
    const players = fake.matches.get('m1')!.players!;
    expect(players['1']?.name).toBe('jon2');
    expect(players['1']?.isBot).not.toBe(true);
    expect(players['2']?.isBot).toBe(true);
  });

  it('skips seats that are already bots', async () => {
    const fake = makeFakeStorage({
      m1: {
        players: {
          '0': { name: 'jon' },
          '1': { isBot: true, name: 'Bot 2' },
          '2': {},
        },
      },
    });
    const result = await fillEmptySeatsWithBots(
      { db: fake.db } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    // Only seat 2 is empty + non-bot.
    expect(result.filled).toEqual(['2']);
  });

  it('returns empty when the match has no empty seats', async () => {
    const fake = makeFakeStorage({
      m1: {
        players: {
          '0': { name: 'jon' },
          '1': { name: 'bob' },
        },
      },
    });
    const result = await fillEmptySeatsWithBots(
      { db: fake.db } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    expect(result.filled).toEqual([]);
  });

  it('returns empty when the server has no usable db', async () => {
    const result = await fillEmptySeatsWithBots(
      { db: undefined } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    expect(result.filled).toEqual([]);
  });

  it('returns empty when the match has no players metadata', async () => {
    const fake = makeFakeStorage({ m1: {} });
    const result = await fillEmptySeatsWithBots(
      { db: fake.db } as Parameters<typeof fillEmptySeatsWithBots>[0],
      'm1',
    );
    expect(result.filled).toEqual([]);
  });
});
