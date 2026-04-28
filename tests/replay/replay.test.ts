// 12.3 — Replay & move-log persistence tests.
//
// We exercise the persistence layer directly (round-trip + LRU eviction)
// and pin the deeper "deep-equal final state" check as `it.todo` — that
// requires constructing a real bgio Client and walking it through several
// moves, which is more than this V1 slice needs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadLogFromLocalStorage,
  saveLogToLocalStorage,
  listLogs,
  REPLAY_KEY_PREFIX,
  type MoveLog,
} from '../../src/replay/MoveLog.ts';

const fakeLog = (matchID: string): MoveLog => ({
  matchID,
  numPlayers: 2,
  setupData: undefined,
  entries: [],
});

const clearReplayStorage = () => {
  if (typeof window === 'undefined') return;
  const ls = window.localStorage;
  // Walk a copy of the key list — `removeItem` shifts indices.
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(REPLAY_KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) ls.removeItem(k);
};

describe('replay module imports', () => {
  it('exports the persistence helpers and the replay driver', async () => {
    const m = await import('../../src/replay/MoveLog.ts');
    expect(typeof m.snapshotLog).toBe('function');
    expect(typeof m.replay).toBe('function');
    expect(typeof m.saveLogToLocalStorage).toBe('function');
    expect(typeof m.loadLogFromLocalStorage).toBe('function');
    expect(typeof m.listLogs).toBe('function');
    expect(typeof m.fetchLogFromServer).toBe('function');
  });
});

describe('saveLogToLocalStorage / loadLogFromLocalStorage', () => {
  beforeEach(clearReplayStorage);
  afterEach(clearReplayStorage);

  it('round-trips a stored log by matchID', () => {
    const log = fakeLog('match-abc');
    saveLogToLocalStorage(log);
    const back = loadLogFromLocalStorage('match-abc');
    expect(back).not.toBeNull();
    expect(back!.matchID).toBe('match-abc');
    expect(back!.numPlayers).toBe(2);
    expect(back!.entries).toEqual([]);
  });

  it('returns null for an unknown matchID', () => {
    expect(loadLogFromLocalStorage('does-not-exist')).toBeNull();
  });

  it('eviction policy: keeps exactly 5 logs after writing 7', async () => {
    // Stagger savedAt timestamps so eviction has a deterministic ordering
    // by waiting a millisecond between writes. (Vitest's fake timers would
    // be cleaner but the round-trip module reads `Date.now()` directly.)
    for (let i = 0; i < 7; i++) {
      saveLogToLocalStorage(fakeLog(`m-${i}`));
      // Yield so `Date.now()` increments (millisecond resolution under
      // Node + jsdom).
      await new Promise((r) => setTimeout(r, 2));
    }
    const remaining = listLogs();
    expect(remaining.length).toBe(5);
    // The oldest two (`m-0`, `m-1`) should have been evicted.
    expect(remaining).not.toContain('m-0');
    expect(remaining).not.toContain('m-1');
    // The five newest must all survive.
    for (let i = 2; i < 7; i++) {
      expect(remaining).toContain(`m-${i}`);
    }
  });

  it.todo('replay() returns a state deep-equal to the live one after 10 moves');
  it.todo('replay falls back to fetchLogFromServer when localStorage is empty');
});
