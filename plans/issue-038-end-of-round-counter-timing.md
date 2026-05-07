# Issue 038 — `endOfRound.onBegin` round-counter timing edge case

**Severity**: medium
**Area**: game / engine
**Effort**: small
**Status**: not started

## Files
- `src/game/phases/endOfRound.ts:13-30`
- `src/game/track/boss.ts:142` — `turnsAtWin = G.round`
- `src/game/endConditions.ts:91` — returns `turnsAtWin ?? G.round`

## Problem
Hooks run when `G.round` is still the old round value; round increments on
`onEnd`. Hooks see the round they're closing (correct semantically). But:
- Bank-log entries get tagged with `round: G.round` (old round). That matches
  intent.
- `traces?` history pushed during chief flip earlier also tags with old round.
- `boss.turnsAtWin = G.round` is captured during the chief's turn before round
  increments. `endIf` returns `turnsAtWin ?? G.round`. If `endIf` evaluates after
  `onEnd`, `G.round` will have ticked up; fortunately `bossResolved=true`
  triggers `endIf` immediately and `turnsAtWin` is captured first.

This is fragile under refactor. A test should pin the invariant.

## Fix sketch
Add a focused test in `tests/game/track/boss.spec.ts` (or
`tests/endConditions.test.ts`): drive a boss-resolves-on-survival sequence and
assert `turnsAtWin === G.round` at the moment of resolution, and that the
display in `GameOverBanner` reflects the right round count.

## Acceptance
- Test pins the timing invariant.
- A future refactor that flips counter-update order is caught.

## Related
- 030 (engine test gaps)
