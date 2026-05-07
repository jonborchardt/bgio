# Issue 033 — MCTSBot dynamic playout missing (only "constructor doesn't throw")

**Severity**: medium
**Area**: tests / AI
**Effort**: medium
**Status**: not started

## Files
- `tests/ai/mcts.smoke.test.ts:32-34`

## Problem
The only assertion is "constructor doesn't throw"; the dynamic test is parked
behind a `gainGold` dispatcher gap that the comment admits is fixable. Without a
real MCTS playout test, all of the ai/enumerate cap-trim logic (also tested
only synthetically) has no end-to-end coverage.

## Fix sketch
Resolve the `gainGold` dispatcher gap (or use a different start-state shortcut),
then drive 5-10 MCTS playouts in a loop and assert: (a) no throws, (b)
deterministic-with-seed reproducibility, (c) playout count matches the iteration
budget.

## Acceptance
- `tests/ai/mcts.smoke.test.ts` runs a real playout assertion.
- A change to enumerate cap-trim logic that breaks MCTS reliably fails this
  test.

## Related
- 029 (broader test backlog)
