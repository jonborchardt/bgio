# Issue 053 — Idle watcher's grant Map never trimmed when matches end

**Severity**: low
**Area**: server / memory
**Effort**: small
**Status**: not started

## Files
- `server/idle/idleWatcher.ts:73-79, 96-124`

## Problem
`lastActivity` and `granted` Maps grow per-match-per-seat and never shrink.
Match completion (`gameover`) does not delete the entry. A long-running server
accumulates one entry per ever-played match.

## Fix sketch
Hook bgio's end-of-match (or read `metadata.gameover` on match fetch) and prune
the Maps. Add a cap with LRU eviction as a safety net.

## Acceptance
- Synthetic test plays N matches and asserts Map sizes don't grow without bound
  after match completion.

## Related
- 003 (bots config — same idle subsystem)
