# Issue 004 — `scienceBot` is a stub returning `null`

**Severity**: high
**Area**: AI / game
**Effort**: medium
**Status**: not started

## Files
- `src/lobby/soloConfig.ts:39-41` — `scienceBot = { play: () => null }`
- `src/fuzz/FuzzPage.tsx:84` — same stub
- (missing) `tests/ai/scienceBot.test.ts`

## Problem
Both the solo lobby and the e2e fuzz harness wire science as a no-op bot. The
science seat therefore only ever falls through to `scienceSeatDone` via the
harness fallback — it never buys/burns library cards or plays blue events. The
boss-debuff `science` threshold is driven by *cards bought*, so the threshold is
never met in solo / e2e play, biasing win-rate measurements and depriving MCTS of
meaningful science-side branches.

## Fix sketch
Implement a real `scienceBot.play()` mirroring `domesticBot`'s structure: scan
`G.library.row`, prefer affordable buys that match a future-tier discount path,
occasionally burn for the +1 token, and end the seat. Should consume the existing
enumerate output from `src/game/roles/science/` (add an enumerate if absent).
Then add `tests/ai/scienceBot.test.ts` to pin the basic behaviour.

## Acceptance
- A 4-player auto-played game (via existing fuzz harness) sees the science seat
  buy at least N library cards over a sample run.
- The boss `science` threshold becomes reachable and is reflected in win-rate
  test.
- New `tests/ai/scienceBot.test.ts` covers: prefers affordable, prefers correct
  color/tier, burns when appropriate.

## Related
- 003 (server `bots` config — without it, scienceBot doesn't run server-side)
- 032 (boss winRate test — once a real scienceBot exists, the win-rate gate
  becomes meaningful)
