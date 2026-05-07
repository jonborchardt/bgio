# Issue 029 — 38 `it.todo` tests cluster around real coverage gaps

**Severity**: medium
**Area**: tests
**Effort**: large (each subgroup is small)
**Status**: not started

## Files
38 `it.todo` calls across 16 test files. Group breakdown:

- **Group A — UI interaction (~20)**: `tests/ui/cards/*`, `tests/ui/library/*`, `tests/ui/track/*`, `tests/ui/Hand.test.tsx`, `tests/ui/DeckStack.test.tsx`, `tests/ui/ChiefPanel.test.tsx`, `tests/ui/GameOverBanner.test.tsx`, `tests/ui/ResourceBag.test.tsx`. Blocked on missing `@testing-library/react`. Real gaps: chief distribute click, domestic produce disable-after-click, win/timeUp accent.
- **Group B — Server (~5)**: `tests/server/auth.test.ts:138`, `tests/server/idle.test.ts:126,129,132,133` cover bot-takeover on disconnect — the meat of 10.9. **Important coverage gap.**
- **Group C — Lobby (~6)**: `tests/lobby/spectator.test.ts:36,39,42,45`, `tests/lobby/lobbyClient.test.ts:32`, `tests/lobby/soloConfig.test.ts:88`, `tests/lobby/credentials.test.ts:75`. Touches networked-build's primary delivery.
- **Group D — Replay (2), MCTS dynamic (1), Debug panel (2)**: smaller surface.

## Problem
38 todos are growing into a backlog. Group B (server bot-takeover, idle reconnect)
is the most critical because the entire networked-bot story is unverified.
Group C (spectator + lobby round-trip) is next. The UI todos are blocked on a
testing-library install.

## Fix sketch
1. Install `@testing-library/react` + `@testing-library/jest-dom` to unblock
   Group A.
2. Tackle Group B first — implement the 5 server it.todos to close the bot
   takeover story (companion to issues 002, 003).
3. Tackle Group C — spectator + lobby round-trips.
4. Group A in priority order: ChiefPanel + DomesticPanel + GameOverBanner first.

## Acceptance
- 38 → 0 it.todo (or each remaining one has an issue ID and a "won't fix" note).
- Server idle/bot-takeover coverage is real.
- UI testing-library is set up and a few key UI tests run.

## Related
- 002, 003 (auth + bots — Group B preconditions)
- 010, 011 (UI fixes — Group A regression coverage)
- 030 (engine-test gap is separate)
