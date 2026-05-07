# Issue 041 — Cross-role imports for engine lookup tables (track→library, track→science)

**Severity**: low
**Area**: game / architecture
**Effort**: medium
**Status**: not started

## Files
- `src/game/track/boss.ts:43-46` — imports from `library/debuff.ts`
- `src/game/track/resolver.ts:82` — imports `SKILLS` from `roles/science`
- `src/game/roles/defense/hooks.ts:45` — also imports from `roles/science`

## Problem
CLAUDE.md says cross-role coordination goes through `hooks.ts`. The track
resolver and the defense hook reach into `roles/science` for `SKILLS`, and
`track/boss.ts` reaches into `library/debuff.ts`. For engine-static lookup
tables, the hooks indirection is impractical, but the layout is structurally
inconsistent.

## Fix sketch
Move shared engine tables out of role folders:
- `roles/science/skills.ts` → `src/game/units/skills.ts` (or
  `src/game/lookup/skills.ts`).
- For boss-debuff: keep `library/debuff.ts` where it is, but expose a
  `BossDebuffCalculator` interface that the track subsystem consumes via a
  registered hook (similar pattern to `registerRoundEndHook`).

Alternatively, document the exception: "engine-static lookups may be imported
across role folders" in CLAUDE.md.

## Acceptance
- Either: the imports are redirected to non-role-scoped locations, OR
- CLAUDE.md documents the exception explicitly.

## Related
- 016 (ESLint could enforce no-cross-role imports if we go architectural)
