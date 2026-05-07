# Issue 049 — `dev-seed.ts` only seeds the in-memory accounts store

**Severity**: low
**Area**: dev tooling
**Effort**: small
**Status**: not started

## Files
- `scripts/dev-seed.ts:21-46`
- `server/auth/accounts.ts`
- `server/auth/sqliteAccountsStore.ts`

## Problem
The script imports `register` and calls it without first setting up the SQLite
store. Anyone running `npm run dev:seed` against a SQLite-backed dev instance
will not actually seed `alice` / `bob` — the registration happens in a different
process / store. The comment ("when the SQLite migration lands this file picks
up the same DB transparently") is no longer accurate post-SQLite swap.

## Fix sketch
Either:
- Embed the same `setAccountsStore(createSqliteAccountsStore({...}))` setup at
  the top of `dev-seed.ts` (gated by `STORAGE_KIND`).
- Or remove the script and document seeding via the `/auth/register` endpoint.

## Acceptance
- `npm run dev:seed` actually inserts users in the store the running server
  uses.
- Comment matches behaviour.

## Related
- 050 (.env.example missing — might land together)
