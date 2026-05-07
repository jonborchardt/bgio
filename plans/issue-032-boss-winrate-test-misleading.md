# Issue 032 — Boss winRate test forces every seat to seatDone — doesn't exercise real bots

**Severity**: medium
**Area**: tests / fuzz / AI
**Effort**: medium
**Status**: not started

## Files
- `tests/fuzz/bossWinRate.test.ts:67-75`

## Problem
`driveOneTrial` literally dispatches `chiefFlipTrack`, `chiefEndPhase`,
`scienceLibraryBurn(0)`, `scienceSeatDone`, `domesticSeatDone`, `defenseSeatDone`
every round. The advertised "win-rate gate" is misleading: with no recruits,
no buildings, no library buys, the boss is always trivially survived (no fail
mode → win). The test name and the orchestrator §6 both claim coverage we don't
actually have.

## Fix sketch
Either:
- Rename to `track-progression-smoke.test.ts` and shrink to its actual scope
  (does the engine run from start to boss-resolution without throwing?), OR
- Replace with a real bot loop that uses the fixed scienceBot (issue 004),
  fixed defenseBot (issue 005), and a real chief tax bot. Run N trials, assert
  win rate within the design target (e.g. 30-70%).

## Acceptance
- Either renamed + scope-honest, or replaced with a meaningful win-rate gate.
- If replaced, the test is documented in `docs/game-design.md` §8 as the
  primary balance signal.

## Related
- 004, 005 (need real bots first)
- 031 (fuzz harness expansion is companion)
