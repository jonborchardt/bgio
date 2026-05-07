# Issue 012 — `src/game/requests/` exists but is undocumented; decide retire-or-document

**Severity**: medium
**Area**: docs / game
**Effort**: medium
**Status**: not started

## Files
- `src/game/requests/blockers.ts`, `clear.ts`, `move.ts`, `types.ts`
- `src/game/index.ts:35, 89` — exports `requestHelp`-related symbols
- `src/game/types.ts:38, 273` — request types in state
- `CLAUDE.md` — never mentions `src/game/requests/`
- `docs/Rules.md` — no mention of cross-seat help requests

## Problem
The `requests/` subsystem (cross-seat help-request rows) is live in code but is
documented nowhere in the canonical rules or layout. README.md does ship a line
about "requests/ — cross-seat help-request rows" but CLAUDE.md's authoritative
layout omits it entirely. Either the feature is part of the design (then
document it in `docs/Rules.md` and CLAUDE.md), or it was retired and the code
should be deleted along with `G.requests` state.

## Fix sketch
Decide. If keeping: write a paragraph in `docs/Rules.md` covering the help-request
loop (who initiates, what blocking semantics it has, how it interacts with chief
distribution), and add a `requests/` line to CLAUDE.md's layout block. If
retiring: remove `src/game/requests/`, drop request types from `SettlementState`,
remove `requestHelp` from the index barrel, and update tests.

## Acceptance
- Either: docs cover the system AND a test exercises a help-request round-trip.
- Or: `src/game/requests/` is gone, `G.requests` removed from state, related UI
  in `src/ui/requests/` retired.

## Related
- 018 (CLAUDE.md / README drift cleanup)
