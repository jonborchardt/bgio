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
// Auth is the in-process Map-backed store from `server/auth/accounts.ts`
// at the moment (the SQLite swap from 13.3 is still pending). When the
// SQLite migration lands this file picks up the same DB transparently
// because `accounts.ts` keeps the same public API.

import { register } from '../server/auth/accounts.ts';

const DEV_ACCOUNTS: ReadonlyArray<{ username: string; password: string }> = [
  { username: 'alice', password: 'password' },
  { username: 'bob', password: 'password' },
];

const seed = async (): Promise<void> => {
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
