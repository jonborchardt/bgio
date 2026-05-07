# Issue 013 — Data schema cleanup: stale fields from retired systems

**Severity**: medium
**Area**: data / types
**Effort**: medium
**Status**: not started

## Files
- `src/data/schema.ts:30` — comment says BossThresholds has 3 fields (science / economy / military)
- `src/data/schema.ts:96-93` — actually has 2 (science, economy)
- `src/data/schema.ts:183, 190, 424, 427` — `UnitDef` requires `altStats` + `initiative`
- `src/data/units.json` — every entry carries `altStats` + `initiative` as dead weight
- `src/data/schema.ts:178` — comment references retired `foreignRecruit`
- `src/game/undo.ts:4` — comment references retired `foreignRecruit, foreignReleaseUnit`
- `src/lobby/soloConfig.ts:101` — comment references `foreignBot`
- `src/game/events/playEventStub.ts:3` — comment references "07.6 foreignPlayRedEvent"
- `src/game/roles/science/setup.ts:7` — `ScienceColor` defined as `'red'|'gold'|'green'|'blue'`; identical to `LibraryColor` in `schema.ts` (duplicate, only declaration site uses it)
- `src/data/index.ts:83-93` — `BENEFIT_TOKENS` includes retired `'unit maintenance'` and `'defense'` verbs
- `src/game/roles/domestic/parseBenefit.ts` — file-top comment notes those verbs were retired in defense redesign 1.4

## Problem
The defense redesign and science-library redesign retired several systems
(battle deck, Foreign role, certain benefit tokens, third boss threshold), but
the schema, JSON content, and stale comments still carry them. This is dead
weight that misleads readers and locks in unused content.

## Fix sketch
Single sweep PR:
1. Update `BossThresholds` comment to "two thresholds (science / economy)".
2. Demote `altStats` + `initiative` to optional or move under a `legacy` block;
   strip from `units.json`.
3. Update all comments referencing `foreign*` to `defense*` or remove.
4. Delete `ScienceColor` from `science/setup.ts`; use `LibraryColor` everywhere.
5. Trim `BENEFIT_TOKENS` to verbs the resolver actually handles today.

## Acceptance
- `tsc --noEmit` clean.
- `npm test` clean.
- Grep for `altStats|initiative|foreign|ScienceColor|unit maintenance` in `src/`
  returns only intentional matches.
- `units.json` no longer carries the dead fields.

## Related
- 014 (CenterMat vestigial — same cleanup theme)
- 017 (trackCards.json no modifier cards — separate but related drift)
