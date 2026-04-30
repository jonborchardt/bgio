// 12.1 — Convenience re-export of the fuzz-suite's conservation invariants.
//
// `tests/fuzz/invariants.ts` owns the canonical `assertNoNegativeResources`,
// `assertConservation`, and `assertTurnsBounded` helpers. Lifting them under
// `tests/helpers/` lets non-fuzz specs reach for the same assertions
// without an awkward `../fuzz/...` import chain — and means the "where do
// invariants live" answer is "tests/helpers/" for the consumer.

export {
  assertConservation,
  assertNoNegativeResources,
  assertTurnsBounded,
} from '../fuzz/invariants.ts';
