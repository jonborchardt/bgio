// @vitest-environment node
//
// 10.7 follow-up — accounts module against the SQLite-backed store.
//
// Mirrors the scenarios in tests/server/auth.test.ts, but with a
// `:memory:` SQLite store wired in via `setAccountsStore(...)`. Soft-
// skips when better-sqlite3 isn't installed, matching the pattern in
// tests/server/sqlite.test.ts so a fresh checkout without `npm install`
// won't fail the suite.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __backdateTokenForTest,
  __resetAccountsForTest,
  login,
  register,
  setAccountsStore,
  verify,
} from '../../server/auth/accounts.ts';
import { createMemoryAccountsStore } from '../../server/auth/accountsStore.ts';
import {
  createSqliteAccountsStore,
  type SqliteAccountsStoreOptions,
} from '../../server/auth/sqliteAccountsStore.ts';
import type { AccountsStore } from '../../server/auth/accountsStore.ts';

const trySqliteStore = (opts: SqliteAccountsStoreOptions = { path: ':memory:' }):
  | AccountsStore
  | null => {
  try {
    return createSqliteAccountsStore(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('better-sqlite3')) return null;
    throw err;
  }
};

describe('accounts on SqliteAccountsStore (10.7 follow-up)', () => {
  let installed = false;

  beforeEach(() => {
    const sqlite = trySqliteStore();
    if (sqlite === null) {
      // Reset to a clean memory store so other tests in the file run
      // (the soft-skip branches still want a working module).
      setAccountsStore(createMemoryAccountsStore());
      installed = false;
      return;
    }
    setAccountsStore(sqlite);
    __resetAccountsForTest();
    installed = true;
  });

  afterEach(() => {
    // Restore the default in-memory store so adjacent test files
    // (auth.test.ts) start from a clean slate.
    setAccountsStore(createMemoryAccountsStore());
  });

  it('register → login → verify round-trip persists through SQLite rows', async () => {
    if (!installed) {
      console.warn('[test] better-sqlite3 not installed; skipping.');
      return;
    }
    const created = await register('alice', 'hunter2hunter2');
    const { user, token } = await login('alice', 'hunter2hunter2');
    expect(user.id).toBe(created.id);
    const verified = await verify(token);
    expect(verified.user?.id).toBe(created.id);
    expect(verified.user?.username).toBe('alice');
  });

  it('rejects a duplicate username (NOCASE collation enforces case-insensitive uniqueness)', async () => {
    if (!installed) return;
    await register('Bob', 'hunter2hunter2');
    await expect(register('bob', 'differentpw1')).rejects.toThrow(
      /already taken/i,
    );
    await expect(register('BOB', 'differentpw1')).rejects.toThrow(
      /already taken/i,
    );
  });

  it('rotates the token when older than 1h', async () => {
    if (!installed) return;
    await register('grace', 'goodpassword');
    const { token } = await login('grace', 'goodpassword');
    const ok = __backdateTokenForTest(token, 2 * 60 * 60 * 1000);
    expect(ok).toBe(true);
    const result = await verify(token);
    expect(result.user?.username).toBe('grace');
    expect(result.token).not.toBe(token);
    // New token verifies; old token is gone.
    const second = await verify(result.token);
    expect(second.user?.username).toBe('grace');
    const stale = await verify(token);
    expect(stale.user).toBeNull();
  });

  it('returns user: null after the token has fully expired', async () => {
    if (!installed) return;
    await register('heidi', 'goodpassword');
    const { token } = await login('heidi', 'goodpassword');
    __backdateTokenForTest(token, 25 * 60 * 60 * 1000);
    const result = await verify(token);
    expect(result.user).toBeNull();
  });

  it('login is case-insensitive on username (NOCASE column)', async () => {
    if (!installed) return;
    await register('Dave', 'goodpassword');
    const result = await login('DAVE', 'goodpassword');
    expect(result.user.username).toBe('Dave');
  });

  it('clear() wipes both users and tokens (FK cascade enabled)', async () => {
    if (!installed) return;
    await register('eve', 'goodpassword');
    const { token } = await login('eve', 'goodpassword');
    __resetAccountsForTest();
    const stale = await verify(token);
    expect(stale.user).toBeNull();
    // Re-registering the same username post-clear should succeed.
    await expect(register('eve', 'goodpassword')).resolves.toBeTruthy();
  });
});

describe('SqliteAccountsStore — direct API smoke', () => {
  it('persists across two store instances pointing at the same file', async () => {
    // `:memory:` is per-connection, so this test uses a tmpfile via the
    // OS tmpdir. Skip if better-sqlite3 isn't installed.
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { mkdtempSync, rmSync } = await import('node:fs');
    const dir = mkdtempSync(join(tmpdir(), 'bgio-auth-'));
    const path = join(dir, 'accounts.sqlite');
    try {
      const first = trySqliteStore({ path });
      if (first === null) {
        console.warn('[test] better-sqlite3 not installed; skipping.');
        return;
      }
      first.clear();
      first.insertUser({
        id: 'user-1',
        username: 'persistent',
        passwordHash: 'fake-hash',
        createdAt: 1234,
      });

      const second = trySqliteStore({ path });
      if (second === null) return;
      const found = second.findUserByLower('persistent');
      expect(found).toBeDefined();
      expect(found?.id).toBe('user-1');
      expect(found?.username).toBe('persistent');
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // tmpdir cleanup is best-effort.
      }
    }
  });
});
