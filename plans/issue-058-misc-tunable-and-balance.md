# Issue 058 — Misc tunable / balance / Rules.md notes (bundled)

**Severity**: low
**Area**: docs / balance
**Effort**: small
**Status**: not started

## Items

### a. Boss `economy: 12` may be unreachably high relative to chief stipend `2` + start bank `3`
- Files: `src/data/trackCards.json` boss card; `src/game/setup.ts:69`; `src/game/resources/bank.ts`
- Capture as a paper-play tunable note in `docs/game-design.md` §8. Revisit
  after content rebalance (issue 008).

### b. Per-color tier debuff vs flat-sum V1 mismatch
- Files: `docs/Rules.md:237-248`; `src/game/library/debuff.ts`
- Rules.md describes per-color tier-N debuffs but V1 implementation sums all
  four colors into a flat reduction. Add a one-sentence
  "V1 implementation: flat sum across colors; per-color flavor mapping deferred"
  in Rules.md §5.2.1.5.

### c. `tsconfig.app.json` could enable `exactOptionalPropertyTypes`
- File: `tsconfig.app.json`
- Would catch the schema's `def.tier = undefined` patterns. Cheap insurance,
  candidate for follow-up PR.

### d. Card-relationship index doesn't surface library color/tier groupings
- Files: `src/cards/relationships.ts`, `src/cards/registry.ts`
- Add a `library-color` / `library-tier` grouping in the graph (or a sibling
  registry view) so the dev panel can filter by tier/color.

## Acceptance
- Each item either addressed or punted to a separate, scoped issue.

## Related
- 008 (content rebalance)
