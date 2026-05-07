# Issue 007 — Run-history persistence is still in-memory

**Severity**: high
**Area**: server / storage
**Effort**: medium
**Status**: not started

## Files
- `server/runs/runs.ts:30-38` — `Map`-backed store
- `server/storage/migrations/002_users_and_runs.sql:26-37` — defines `runs` table that nothing reads or writes
- `server/storage/migrations/002_users_and_runs.sql` — also has stale `settlements_joined INTEGER NOT NULL` column

## Problem
CLAUDE.md states "the runs history table from migration 002 is the remaining 10.7
follow-up." The schema is there; nothing wires it. On Render, every restart wipes
user run history even though users + tokens persist (the false impression the
whole module is durable). The migration also still references a column from the
retired pre-defense-redesign schema.

## Fix sketch
1. Drop and recreate migration `002_users_and_runs.sql` without
   `settlements_joined` (this is pre-prod, no data loss risk; alternative is a
   `003_drop_settlements_joined.sql`).
2. Build a `SqliteRunsStore` paralleling `server/auth/sqliteAccountsStore.ts`.
3. Wire `setRunsStore(...)` from `server/index.ts` when `STORAGE_KIND=sqlite`.
4. Update the runs UI / dashboard (if any) to read from the new persisted source.

## Acceptance
- Restarting the server preserves run history when `STORAGE_KIND=sqlite`.
- Migration runs cleanly on a fresh DB and on an existing DB.
- A test in `tests/server/runs.test.ts` exercises insert + fetch across "restart"
  (close + reopen DB connection).

## Related
- 022 (SQLite migrations have no version table — addresses both)
