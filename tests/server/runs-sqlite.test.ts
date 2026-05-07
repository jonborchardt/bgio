// @vitest-environment node
//
// Issue 007 — SQLite-backed runs store: persistence across "restart".
//
// We open the same DB file with two store instances in succession to
// model a server restart. Inserts via the first store should be
// visible to the second; that's the contract migration 002 was always
// supposed to deliver.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setRunsStore, recordRun, listRunsByUser } from '../../server/runs/runs.ts';
import {
  createMemoryRunsStore,
  type RunsStore,
} from '../../server/runs/runsStore.ts';
import { createSqliteRunsStore } from '../../server/runs/sqliteRunsStore.ts';
import {
  register,
  setAccountsStore,
} from '../../server/auth/accounts.ts';
import {
  createMemoryAccountsStore,
} from '../../server/auth/accountsStore.ts';
import { createSqliteAccountsStore } from '../../server/auth/sqliteAccountsStore.ts';
import type { AccountsStore } from '../../server/auth/accountsStore.ts';

let dir: string;
const openedRuns: RunsStore[] = [];
const openedAccounts: AccountsStore[] = [];

const installStores = (path: string): void => {
  // Issue 007 — accounts and runs share the SQLite file in production.
  // Tests mirror that so the FK constraint on runs.user_id is satisfied
  // by a real users row, not a synthesized one.
  const accounts = createSqliteAccountsStore({ path });
  openedAccounts.push(accounts);
  setAccountsStore(accounts);
  const runs = createSqliteRunsStore({ path });
  openedRuns.push(runs);
  setRunsStore(runs);
};

const closeOne = (s: RunsStore | AccountsStore): void => {
  const closer = (s as { close?: () => void }).close;
  if (typeof closer === 'function') closer.call(s);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'runs-sqlite-'));
});

afterEach(() => {
  while (openedRuns.length > 0) closeOne(openedRuns.pop()!);
  while (openedAccounts.length > 0) closeOne(openedAccounts.pop()!);
  setRunsStore(createMemoryRunsStore());
  setAccountsStore(createMemoryAccountsStore());
  rmSync(dir, { recursive: true, force: true });
});

describe('SqliteRunsStore (issue 007)', () => {
  it('persists runs across reopen of the same DB file', async () => {
    const path = join(dir, 'settlement.sqlite');

    installStores(path);
    const user = await register('alice', 'password1234');
    await recordRun({
      userID: user.id,
      matchID: 'm1',
      outcome: 'win',
      turns: 42,
    });
    // Close the first connections before reopening so SQLite flushes
    // the WAL into the main DB file the second connections read.
    closeOne(openedRuns.pop()!);
    closeOne(openedAccounts.pop()!);

    installStores(path);
    const list = await listRunsByUser(user.id);
    expect(list.length).toBe(1);
    expect(list[0]?.matchID).toBe('m1');
    expect(list[0]?.outcome).toBe('win');
    expect(list[0]?.turns).toBe(42);
  });

  it('is idempotent on (matchID, userID) like the in-memory store', async () => {
    const path = join(dir, 'idem.sqlite');
    installStores(path);
    const user = await register('bob', 'password1234');
    const first = await recordRun({
      userID: user.id,
      matchID: 'm1',
      outcome: 'win',
      turns: 10,
    });
    const second = await recordRun({
      userID: user.id,
      matchID: 'm1',
      outcome: 'timeUp',
      turns: 999,
    });
    expect(second.id).toBe(first.id);
    expect(second.outcome).toBe('win');
    expect(second.turns).toBe(10);
  });
});
