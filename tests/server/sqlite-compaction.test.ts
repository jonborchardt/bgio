// @vitest-environment node
//
// Issue 054 — log-compaction smoke. The SQLite storage adapter ships
// `compactCompletedMatches(olderThanMs)` which drops the per-match log
// for matches whose metadata.gameover is set AND were last touched
// more than `olderThanMs` ago. The bgio Server schedules this in
// production (one tick / hour, 7-day retention).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeSqliteStorage } from '../../server/storage/sqlite.ts';

interface CompactableStorage {
  createMatch: (id: string, opts: unknown) => Promise<void>;
  setState: (id: string, state: unknown, log?: unknown[]) => Promise<void>;
  setMetadata: (id: string, metadata: unknown) => Promise<void>;
  fetch: (id: string, opts: { log?: boolean }) => Promise<{ log?: unknown[] }>;
  compactCompletedMatches: (olderThanMs: number) => Promise<number>;
  disconnect?: () => Promise<void>;
}

let dir: string;
let storage: CompactableStorage;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sqlite-compact-'));
  storage = makeSqliteStorage({
    path: join(dir, 'compact.sqlite'),
  }) as CompactableStorage;
});

afterEach(async () => {
  await storage.disconnect?.();
  rmSync(dir, { recursive: true, force: true });
});

const seed = async (matchID: string, log: number) => {
  await storage.createMatch(matchID, {
    metadata: { gameName: 'settlement' },
    initialState: { _stateID: 0, G: {}, ctx: {} },
  });
  // Drive the log up to `log` entries via repeated setState calls.
  for (let i = 0; i < log; i += 1) {
    await storage.setState(matchID, { _stateID: i + 1, G: {}, ctx: {} }, [
      { idx: i, payload: 'move-' + i },
    ]);
  }
};

describe('SqliteStorage.compactCompletedMatches (issue 054)', () => {
  it('skips matches whose metadata.gameover is unset', async () => {
    await seed('m-active', 5);
    // No gameover set — compaction must NOT touch this match.
    const wiped = await storage.compactCompletedMatches(0);
    expect(wiped).toBe(0);
    const fetched = await storage.fetch('m-active', { log: true });
    expect(fetched.log?.length).toBe(5);
  });

  it('drops the log for completed matches older than the threshold', async () => {
    await seed('m-done', 10);
    // Mark the match as gameover and backdate its updated_at by
    // setting metadata to something ancient. setMetadata bumps
    // updated_at to Date.now(), so compactCompletedMatches(0) treats
    // every gameover-set match as eligible.
    await storage.setMetadata('m-done', {
      gameName: 'settlement',
      gameover: { kind: 'win' },
    });
    const wiped = await storage.compactCompletedMatches(0);
    expect(wiped).toBe(1);
    const fetched = await storage.fetch('m-done', { log: true });
    expect(fetched.log?.length).toBe(0);
  });

  it('respects olderThanMs — fresh completions are NOT compacted', async () => {
    await seed('m-fresh', 3);
    await storage.setMetadata('m-fresh', {
      gameName: 'settlement',
      gameover: { kind: 'win' },
    });
    // 1 hour threshold; the match was completed milliseconds ago.
    const wiped = await storage.compactCompletedMatches(60 * 60 * 1000);
    expect(wiped).toBe(0);
    const fetched = await storage.fetch('m-fresh', { log: true });
    expect(fetched.log?.length).toBe(3);
  });
});
