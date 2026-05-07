# Issue 026 — `CardInfoProvider` context value rebuilt every render

**Severity**: medium
**Area**: ui / perf
**Effort**: small
**Status**: not started

## Files
- `src/ui/cards/CardInfoContext.tsx:28-33`

## Problem
The `value={{ isOpen, focusId, ... }}` literal is a fresh object on every parent
render, so every `useCardInfo()` consumer re-renders even when nothing changed.
The `?` button on every card and the relationships modal both subscribe — not
free during games with many cards on screen.

## Fix sketch
Wrap the context value in `useMemo` keyed on the six dependencies. Optionally
split read-only state from setters into two contexts (Kent C. Dodds pattern) so
setter-only consumers don't re-render on state changes.

## Acceptance
- A render of any unrelated parent does not re-render `useCardInfo()` consumers
  (verifiable via React DevTools profiler).

## Related
- 028 (RelationshipsModalHost re-renders — same family)
