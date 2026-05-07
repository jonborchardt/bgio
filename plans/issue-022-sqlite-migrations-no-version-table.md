# Issue 022 — SQLite migrations have no version table; SQL files re-run every boot

**Severity**: medium
**Area**: server / storage
**Effort**: medium
**Status**: not started

## Files
- `server/storage/sqlite.ts:118-131` — `runMigrations` blindly `db.exec(readFileSync(...))` for every `*.sql` file
- `server/auth/sqliteAccountsStore.ts:80-86` — same pattern, separate connection

## Problem
For now this works because every statement uses `IF NOT EXISTS`. But the moment
someone writes a `CREATE TABLE foo (col INT)` (without `IF NOT EXISTS`) or an
`ALTER TABLE` for a real schema change, both will throw on the second-and-later
boots. Worse, `sqliteAccountsStore` and `SqliteStorage` open separate connections
and each runs migrations independently — they'll race on the same file at first
boot.

## Fix sketch
1. Add a `_migrations` table that records applied filenames + timestamps.
2. Single shared migrator entry point (e.g. `server/storage/migrate.ts`) used by
   both stores.
3. Acquire an `EXCLUSIVE` lock during migration to avoid the race.
4. Document the migration-naming convention in `server/storage/migrations/README.md`.

## Acceptance
- A new migration with no `IF NOT EXISTS` runs once and is skipped thereafter.
- Concurrent boot of two stores does not double-apply.
- Test in `tests/server/migrations.test.ts` covers (a) clean DB, (b) re-boot, (c)
  add migration mid-flight.

## Related
- 007 (runs persistence — depends on this for any non-trivial schema change)
