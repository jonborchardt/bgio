# Issue 037 — `defenseBot.test.ts` hard-codes seat `'3'` instead of using `seatOfRole`

**Severity**: low
**Area**: tests
**Effort**: small
**Status**: not started

## Files
- `tests/ai/defenseBot.test.ts:38-44, 60-66`

## Problem
The tests assume `'3'` is the defense seat. `assignRoles(4)` does happen to put
defense at seat 3 in current `roles.ts`, but neither the test nor the helper
asserts that. A future change to `assignRoles` would make every defense bot test
silently misroute.

## Fix sketch
Use `seatOfRole(roleAssignments, 'defense')` (already used by
`tests/fuzz/bossWinRate.test.ts`) to derive the seat ID dynamically.

## Acceptance
- Tests don't reference `'3'` literally for defense seat.
- A flipped seat assignment in a fixture still routes correctly.

## Related
- (none — small standalone fix)
