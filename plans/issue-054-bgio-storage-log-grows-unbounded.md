# Issue 054 — bgio storage adapter `log` table grows unbounded per match

**Severity**: low
**Area**: server / storage
**Effort**: medium
**Status**: not started

## Files
- `server/storage/sqlite.ts:251-283`

## Problem
Transactions are correct and prepared statements are parameterized — no SQLi
risk. Structural concern: a long match's `log` table grows unbounded; bgio's
replay machinery walks the whole array on each `fetch({ log: true })`. Future
cost as match counts grow.

## Fix sketch
Either:
- Per-match log cap (drop entries older than N moves) — risky for replay.
- "Compact closed matches" cron that snapshots final state + drops log for
  matches with `gameover` set older than X days.

## Acceptance
- A long-running server doesn't accumulate unbounded log rows for completed
  matches.

## Related
- 022 (migrations — would need a new migration to add the cron table or
  retention column)
