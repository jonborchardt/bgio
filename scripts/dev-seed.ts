// 12.7 — Idempotent dev account seeding.
//
// Creates `alice` and `bob` (password `password`) so `npm run dev:full`
// developers can log in immediately without registering. Re-runs of
// this script are no-ops once the accounts exist — `register` throws
// "username already taken" and we swallow that error specifically.
//
// Triggered manually:
//   npm run dev:seed
//
// Or wired into `dev:full` startup as a tiny pre-step. We don't auto-run
// from inside `dev-full` today: the seed only matters when networked
// mode is active *and* the storage adapter is the persistent one
// (10.4 SQLite). Hot-seat dev doesn't need it.
//
// Issue 049 — when the running server uses STORAGE_KIND=sqlite, the
// in-memory accounts store this script defaults to is a different
// process / table than the dev server, so the seeded users would
// never appear in the live login flow. We mirror the bootstrap from
// `server/index.ts`: read STORAGE_KIND, and if it's `sqlite` swap
// the accounts module's backing store to a SQLite-backed instance
// pointed at the same DB file the server uses.

import {
  register,
  setAccountsStore,
} from '../server/auth/accounts.ts';
import { createSqliteAccountsStore } from '../server/auth/sqliteAccountsStore.ts';

const installSqliteIfRequested = (): void => {
  const kind = process.env.STORAGE_KIND;
  if (kind !== 'sqlite') return;
  try {
    const sqlitePath = process.env.SQLITE_PATH;
    setAccountsStore(
      createSqliteAccountsStore(
        sqlitePath !== undefined ? { path: sqlitePath } : {},
      ),
    );
    console.log(
      `[dev-seed] using SQLite accounts store at ${sqlitePath ?? '<default>'}`,
    );
  } catch (err) {
    console.warn(
      '[dev-seed] SQLite accounts store init failed — keeping in-memory store:',
      err instanceof Error ? err.message : err,
    );
  }
};

const DEV_ACCOUNTS: ReadonlyArray<{ username: string; password: string }> = [
  { username: 'alice', password: 'password' },
  { username: 'bob', password: 'password' },
];

const seed = async (): Promise<void> => {
  installSqliteIfRequested();
  for (const acct of DEV_ACCOUNTS) {
    try {
      await register(acct.username, acct.password);
      console.log(`[dev-seed] created '${acct.username}'`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already taken')) {
        console.log(`[dev-seed] '${acct.username}' already exists — skipped`);
        continue;
      }
      // Validation errors (username chars, password length) — these are
      // pinned hardcoded above, so a real error here means a regression
      // worth surfacing.
      throw e;
    }
  }
};

void seed();
