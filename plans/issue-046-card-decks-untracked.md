# Issue 046 — `card-decks/` is untracked with no `.gitignore` entry

**Severity**: low
**Area**: repo hygiene
**Effort**: small
**Status**: not started

## Files
- `e:/github2/bgio/card-decks/` — untracked, contains 5 candidate deck rewrites + REPORT.md

## Problem
git status shows the entire `card-decks/` tree as untracked. It looks
deliberate (5 alternative deck proposals + a top-level REPORT), but its status
is ambiguous — neither tracked nor ignored. New contributors won't know whether
to commit local edits or treat it as scratch.

## Fix sketch
Decide:
- (a) Check it in to `card-decks/` so reviews are reproducible, OR
- (b) Add `card-decks/` to `.gitignore` if it's local scratch, OR
- (c) Move into `docs/card-decks/` or `plans/content/` if it's design exploration
  that should live with project docs.

## Acceptance
- `git status` is clean (or `card-decks/` is gone).

## Related
- 008 (the `04-color-balanced/` snapshot is a candidate replacement for current
  content)
