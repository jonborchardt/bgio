# Issue 030 — Engine test gaps: bankLog/economyHigh, centerBurn, computeRunScore, hook ordering

**Severity**: medium
**Area**: tests / engine
**Effort**: medium
**Status**: not started

## Files
- `src/game/resources/bankLog.ts` — no `tests/resources/bankLog.test.ts`
- `src/game/track/centerBurn.ts` — no dedicated test (only indirect via resolver)
- `src/game/endConditions.ts > computeRunScore` — narrow `endConditions.test.ts` only sets `economyHigh = 100` manually
- `src/game/hooks.ts` + multiple registration sites (track, tax, drill, libraryBurn, produce, defense/hooks, events/state) — no test pins registration-order = run-order across the live registry

## Problem
The single mutator `appendBankLog` updates `G.economyHigh` (read by the boss
economy threshold). No test exercises a real sequence of moves
(chiefDistribute push/pull, domestic purchases, threat center-burn) to verify
economy-high stays correct across rounds. Similarly, `centerBurn` and
`computeRunScore` lack focused unit tests, and the round-end hook ordering
invariant is fragile under tree-shaking / HMR.

## Fix sketch
1. `tests/resources/bankLog.test.ts`: drive 5-10 moves through `runMoves`,
   assert `bankLog` entries + `economyHigh` running max stays correct.
2. `tests/game/track/centerBurn.test.ts`: synthesize a threat that reaches
   center, assert burn semantics + bankLog entry.
3. `tests/game/endConditions/computeRunScore.test.ts`: HP-percent rounding,
   zero-building grids, win vs time-up.
4. `tests/hooks/orderInvariant.test.ts`: import-side-effect free assertion that
   listed hook names appear in expected order in `runRoundEndHooks`.

## Acceptance
- Each surface has at least one focused test.
- Coverage report shows `bankLog.ts`, `centerBurn.ts`, `computeRunScore` >80%
  line coverage.

## Related
- 029 (broader test backlog)
