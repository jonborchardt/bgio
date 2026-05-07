# Issue 021 — Dead UI directories from prior redesigns

**Severity**: medium
**Area**: ui
**Effort**: small
**Status**: not started

## Files
- `src/ui/hand/Hand.tsx` — generic Hand, comment notes the "real" wired one is in `src/ui/domestic/`
- `src/ui/deck/DeckStack.tsx` — not imported anywhere
- `src/ui/layout/PhaseHint.tsx`, `phaseHintRules.ts` — not imported
- `src/ui/mat/CenterMat.tsx:162-176` — `CenterMat()` wrapper export (Board imports `SeatTiles` directly)

## Problem
These files are not imported anywhere outside their own files. They predate the
defense / library redesigns and ship in the bundle as dead weight. Keeping them
around invites confusion ("which Hand do I edit?") and forces grep noise.

## Fix sketch
Delete the files (and the unused wrapper). Verify with a fresh `tsc -b` and
`npm test`. If any of them was load-bearing for an alternative path you want to
keep, document why in a one-line comment instead of leaving as silently-dead.

## Acceptance
- Files deleted, build + tests still green.
- Grep for the deleted symbol names returns zero.

## Related
- 014 (CenterMat type cleanup — same theme)
- 029 (UI-test it.todos for these files become moot)
