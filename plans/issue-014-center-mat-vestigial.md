# Issue 014 — `CenterMat` is a vestigial empty interface

**Severity**: low
**Area**: game / types
**Effort**: small
**Status**: not started

## Files
- `src/game/resources/centerMat.ts:11` — comment says Phase 2.4 will fill it (Phase 2 already shipped)
- `src/game/resources/centerMat.ts:18-22` — empty interface
- `src/game/types.ts:85` — uses it
- `src/game/setup.ts:148` — populates empty
- `src/ui/mat/CenterMat.tsx:162-176` — unused wrapper export

## Problem
`CenterMat` was a placeholder for the per-round track strip that ultimately
landed on `G.track`. The empty interface lingers; ESLint must explicitly silence
the empty-type rule. The UI's `CenterMat()` wrapper component is also dead
(Board imports `SeatTiles` directly).

## Fix sketch
Remove `centerMat` from `SettlementState`, delete `src/game/resources/centerMat.ts`,
delete the unused `CenterMat()` wrapper in `src/ui/mat/CenterMat.tsx` (keep
`SeatTiles`), and update setup + types.

## Acceptance
- `tsc --noEmit` clean.
- `npm test` clean.
- Grep for `CenterMat`/`centerMat` returns only the `SeatTiles` file references.

## Related
- 013 (broader schema cleanup)
- 021 (dead UI directories)
