# Issue 035 — Defense bot composed `play()` doesn't use the path-weighting it computes

**Severity**: medium (downstream of issue 005)
**Area**: AI
**Effort**: small (no separate fix once 005 lands)
**Status**: not started

## Files
- `src/game/ai/defenseBot.ts:33-41`
- `src/game/roles/defense/ai.ts:170-183`

## Problem
Both composed-bot paths take the *first* non-`defenseSeatDone` candidate. The
role enumerator's "covering placements lead the list" only matters because the
lead is picked. With the off-by-one bug from issue 005, no candidate ever
covers, so the composed bot effectively places at the topmost-leftmost tile
regardless of telegraphed threats. Once issue 005 is fixed this becomes correct
automatically; flag for awareness only.

## Fix sketch
After issue 005 lands, verify the composed bot does prefer covering placements
in a fresh test. If issue 005's fix invalidates the "covering placements lead"
ordering, restore it.

## Acceptance
- After 005 lands, the test from 005 still passes via `defenseBot.play` (not
  just the enumerator directly).

## Related
- 005 (root cause)
