// 10.6 — credentials persistence tests.
//
// jsdom (the default vitest environment) ships a real-ish localStorage,
// so we exercise saveCreds / loadCreds / clearCreds end-to-end without
// mocking. Each test wipes the slot in `afterEach` so cross-test
// contamination is impossible.

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCreds,
  loadCreds,
  saveCreds,
  type SessionCreds,
} from '../../src/lobby/credentials.ts';

const STORAGE_KEY = 'settlement.session';

const baseCreds: Omit<SessionCreds, 'expiresAt'> = {
  matchID: 'match-xyz',
  playerID: '0',
  credentials: 'cred-string-from-bgio',
  serverUrl: 'http://localhost:8000',
};

afterEach(() => {
  // Belt + suspenders: clearCreds() may have been called by the SUT, but
  // a failing test could leave the slot dirty.
  window.localStorage.removeItem(STORAGE_KEY);
});

describe('credentials (10.6)', () => {
  it('saveCreds → loadCreds round-trips with a fresh expiresAt', () => {
    saveCreds(baseCreds);
    const got = loadCreds();
    expect(got).not.toBeNull();
    expect(got?.matchID).toBe(baseCreds.matchID);
    expect(got?.playerID).toBe(baseCreds.playerID);
    expect(got?.credentials).toBe(baseCreds.credentials);
    expect(got?.serverUrl).toBe(baseCreds.serverUrl);
    // saveCreds defaults expiresAt to now + 24h. Allow a generous window.
    const future = Date.now() + 24 * 60 * 60 * 1000;
    expect(got!.expiresAt).toBeGreaterThan(Date.now());
    expect(got!.expiresAt).toBeLessThanOrEqual(future + 1000);
  });

  it('returns null for an expired entry and auto-clears the slot', () => {
    saveCreds({ ...baseCreds, expiresAt: Date.now() - 1 });
    expect(loadCreds()).toBeNull();
    // Auto-clear: the next save should hit a clean slot, but more directly:
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearCreds removes the storage key', () => {
    saveCreds(baseCreds);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    clearCreds();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadCreds()).toBeNull();
  });

  it('returns null for a malformed JSON blob (and clears it)', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{{{');
    expect(loadCreds()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null for a parseable-but-misshapen blob', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ matchID: 'x', playerID: '0' }),
    );
    expect(loadCreds()).toBeNull();
  });

  it.todo(
    'server-down spinner: probe failure triggers retry-with-backoff (1s/2s/5s/15s/30s/60s, capped) and a manual retry button resets the schedule',
  );
});
