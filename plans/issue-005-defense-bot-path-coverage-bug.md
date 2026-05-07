# Issue 005 — Defense bot does not weight placements by next-threat path (failing test)

**Severity**: high
**Area**: AI / game
**Effort**: small
**Status**: not started

## Files
- `src/game/roles/defense/ai.ts:113-134` — bot bucketing logic
- `src/game/track/path.ts:182-193` — `tileCoversPath` defines `radius = range - 1`
- `tests/ai/defenseBot.test.ts:148` — failing test (`expected '1,0' to be '3,3'`)

## Problem
Baseline `npm test` produces 1 failing test. The bot logic *does* try to bucket
placements by `tileCoversPath`, but the geometry contract is off-by-one: a
`range = 1` Scout uses `radius = 0`, so it only covers cells *on its own tile*.
The test seeds `(1,0)` (one cell off the path running along x=0) plus a Scout
(range 1) and expects coverage to (0,0). Either the geometry should treat
`range = 1` as "self + adjacent ring" (`radius = range`), or range-1 units are
useless in practice and the rules should reflect that.

The downstream consequence: `defenseBot.play()` (composed bot) just takes the
first non-`defenseSeatDone` candidate. With no candidate ever covering, it
effectively places at the topmost-leftmost tile regardless of telegraphed
threats — so even the heuristic doesn't function.

## Fix sketch
Decide: do range-1 Scouts cover their adjacent ring? If yes (the more useful
interpretation, makes Scouts actually useful), change `tileCoversPath` to
`radius = range`. If no, the test contract is wrong and should seed a
higher-range unit or place at (0,0). Update both `path.ts` and a comment in
`Rules.md` to make the convention explicit.

## Acceptance
- `tests/ai/defenseBot.test.ts > prefers placements that cover the telegraphed next-threat path` passes.
- `npm test` is green (currently 1 failing).
- Geometry convention documented in `Rules.md` §6 (defense / combat).

## Related
- 035 (composed defenseBot.play picks first candidate — once weighting works, the
  composed bot benefits automatically)
- 036 (RandomBot fuzz still omits defense recruits — separate issue)
