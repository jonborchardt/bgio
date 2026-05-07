# Issue 009 — `resolveThreat` duplicates path entries when threat reaches center

**Severity**: high
**Area**: game / engine
**Effort**: small
**Status**: not started

## Files
- `src/game/track/resolver.ts:382-438`

## Problem
The first impact loop appends to `traceImpactTiles`, breaks out when `damage <= 0`,
then the post-loop tracePath builder iterates the **entire** `path` again. When
`damage > 0` survives all the way to center, line 430 pushes every cell of `path`
into `tracePath` even though cells *upstream* of the first impact were never used
for a fire visualization. When `damage <= 0` after partial impact, the second
branch (lines 432-437) pushes every cell of `path` up to and including the last
impact. This double-includes cells already covered by the fire-slice in the
trace and can produce mis-ordered traces because `path` is iterated again from 0
instead of resuming from where the impact loop stopped.

## Fix sketch
Build `tracePath` once during the impact walk, in the same loop that appends to
`traceImpactTiles`. Track the last-cell-touched index and slice `path` once at the
end if a center burn occurred.

## Acceptance
- Existing resolver tests still pass.
- New test pin in `tests/game/track/resolver.spec.ts` covers (a) threat dies
  mid-path, (b) threat reaches center — both produce non-duplicate, in-order
  trace paths.
- `tracePath.length === unique(tracePath).length` invariant added as a runtime
  assert (dev-only).

## Related
- 030 (engine test gap covers centerBurn — same surface)
