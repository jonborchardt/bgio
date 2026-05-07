# Issue 036 — `chiefBot` never selects the new Tax super-power

**Severity**: medium
**Area**: AI
**Effort**: small
**Status**: not started

## Files
- `src/game/ai/chiefBot.ts` — `play()` only distributes + flips + ends
- `src/game/roles/chief/tax.ts` — recent commit `19c3937` added the move
- (missing) `tests/ai/chiefBot.test.ts` — narrow tax coverage

## Problem
`chiefTax` is enumerated by `enumerate.ts:135-150` but `chiefBot.play` never
selects it. The Tax super-power is the chief's primary economy lever post-redesign;
a bot that never uses it understates the chief's capability and biases win-rate
measurements.

## Fix sketch
Add Tax to `chiefBot.play`'s heuristic: prefer Tax once per round when bank gold
is below a threshold or when distribution would leave the chief without a buffer
for the next round. Add a focused test pinning the heuristic.

## Acceptance
- `chiefBot.play` selects `chiefTax` at least once per N=10 simulated games when
  bank gold is low.
- Test pins the heuristic.

## Related
- 032 (boss winRate gate becomes more meaningful with a tax-using chief)
