# Issue 047 — Stale screenshots at repo root

**Severity**: low
**Area**: repo hygiene
**Effort**: small
**Status**: not started

## Files
- `card-sweep-after-pick.png`
- `card-sweep-mui.png`

## Problem
Both PNGs sit in the project root with zero references in `src/`, docs, or
README.md. Likely leftovers from a prior PR.

## Fix sketch
Delete them, or move to a `screenshots/` subfolder and link from README.md / a
plan file.

## Acceptance
- No PNGs at repo root, OR each is intentionally tracked and referenced from a
  doc.

## Related
- 018 (doc drift cleanup)
