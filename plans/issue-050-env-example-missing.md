# Issue 050 — `.env.example` is missing; dev path drift

**Severity**: low
**Area**: dev tooling / docs
**Effort**: small
**Status**: not started

## Files
- (missing) `.env.example`
- (missing) `.env.local` reference target
- `scripts/dev-full.md:36-46` — references both
- `server/README.md:60` — documents `SQLITE_PATH` default as `./.dev-data/settlement.sqlite`
- `server/auth/sqliteAccountsStore.ts:70` — code default `./bgio-data/settlement.sqlite`
- `server/storage/sqlite.ts:139` — code default `./bgio-data/settlement.sqlite`

## Problem
A new contributor following docs has no `.env.example` template to copy.
Additionally, the documented default SQLite path differs from the code
default — pick one.

## Fix sketch
1. Add `.env.example` with documented vars (`STORAGE_KIND`, `SQLITE_PATH`,
   `PORT`, `ALLOWED_ORIGINS`, etc.) — comments only, no secrets.
2. Confirm `.env.local` is in `.gitignore` (it isn't explicitly listed; `*.local`
   would catch it but be explicit).
3. Pick one canonical SQLite path default and update both code and docs.

## Acceptance
- `.env.example` exists with all required vars.
- Code default and docs default match.

## Related
- 006 (CORS / origins env var)
- 048 (npm script docs)
