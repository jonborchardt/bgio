# Issue 020 — Only ~4 of 16 events carry library tagging

**Status**: WON'T DO — resolved by the deck-selection refactor.

The active deck (`card-decks/06-merged-best`) ships **24 events, all
tagged with `{ scienceColor, tier }`** — even split 6 gold / 6 blue
/ 6 green / 6 red. The library-row now sees the full event surface;
no events are silently library-exempt. Closed without code work.

**Severity**: medium
**Area**: data / content
**Effort**: small
**Status**: not started

## Files
- `src/data/events.json` — 12 of 16 lack `tier` / `scienceColor`
- `src/game/library/setup.ts:~30` — only collects tagged cards

## Problem
Untagged events silently never appear in the library deck, so chief-event
content is under-represented. Compounds the content imbalance from issue 008.

## Fix sketch
Tag every event as part of the broader content rebalance pass (issue 008), or
explicitly document the omission as intentional with a short comment in
`events.json` or in `docs/game-design.md` §6.

## Acceptance
- Every event entry has `tier` + `scienceColor`, OR an explicit comment
  documents which events are intentionally library-exempt.
- `library/setup.ts` builds a deck with the expected gold (event) count.

## Related
- 008, 019
