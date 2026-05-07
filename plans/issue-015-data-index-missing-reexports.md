# Issue 015 — `src/data/index.ts` doesn't re-export `EVENT_CARDS` / `ADJACENCY_RULES`

**Severity**: medium
**Area**: data / conventions
**Effort**: small
**Status**: not started

## Files
- `src/data/index.ts` — only re-exports `BUILDINGS`, `UNITS`, `TECHNOLOGIES`, `TRACK_CARDS`, `BENEFIT_TOKENS`, `buildingCost`, `unitCost`
- Consumers: `src/cards/registry.ts`, `src/game/roles/domestic/adjacency.ts`, `src/cards/relationships.ts` — all import `events.ts` / `adjacency.ts` directly
- `README.md:87` — claims `EVENT_CARDS` and `ADJACENCY_RULES` are exported from the data barrel

## Problem
CLAUDE.md says "imports always go through the loaders … never the raw JSON," and
the data barrel is supposed to be the single import boundary. Two real loaders
bypass it because they're not exposed.

## Fix sketch
Add `export { EVENT_CARDS } from './events';` and
`export { ADJACENCY_RULES } from './adjacency';` to `src/data/index.ts`. Update
the three consumer files to import via the barrel. Confirm README and CLAUDE.md
match.

## Acceptance
- `src/data/index.ts` re-exports both.
- No file under `src/` imports `data/events` or `data/adjacency` directly.
- README's exported-names list matches reality.

## Related
- 016 (ESLint rule should enforce going through the barrel)
- 018 (README drift cleanup)
