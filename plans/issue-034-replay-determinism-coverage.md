# Issue 034 — Replay-driver determinism coverage gap

**Severity**: medium
**Area**: tests / replay
**Effort**: small
**Status**: not started

## Files
- `tests/replay/replay.test.ts:87-88`
- `src/replay/`

## Problem
Two `it.todo`: deep-equal final state after 10 moves, and `fetchLogFromServer`
fallback. The actual replay driver `replay()` is asserted only to be a function.
Determinism between live + replay is the whole point of `src/replay/`; without
that test, a regression in `setup` randomness or move ordering would silently
break replay.

## Fix sketch
Implement the deep-equal pin: drive 10 moves through `runMoves`, snapshot the
final state, then run `replay()` on the same log against a fresh Settlement
instance and assert deep equality. Also pin `fetchLogFromServer` fallback with a
mocked fetch.

## Acceptance
- Both it.todos implemented and passing.
- A deliberate `Math.random` insertion in any setup path fails this test.

## Related
- 029 (broader test backlog)
- 042 (random-fallback in setup.ts — same area)
