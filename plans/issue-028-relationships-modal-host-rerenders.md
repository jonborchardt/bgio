# Issue 028 — `RelationshipsModalHost` re-renders entire graph on every `G` change

**Severity**: medium
**Area**: ui / perf
**Effort**: small
**Status**: not started

## Files
- `src/Board.tsx:278` — `<RelationshipsModalHost matchState={G} />`
- `src/ui/relationships/RelationshipsModalHost.tsx`

## Problem
`G` identity changes on every move (Immer produces new immutable trees). Even
when the modal is closed, the prop churn forces React to compare. Inside,
`RelationshipsModal` builds `buildCardGraph(G)` per the docstring — if the graph
build is non-trivial, this is real CPU per move.

## Fix sketch
Gate on `ctx.isOpen`:
```tsx
const open = useCardInfo().isOpen;
return open ? <RelationshipsModal matchState={G} /> : null;
```
Or wrap `buildCardGraph` in `useMemo([G.<only-relevant-slices>])`. The graph
likely depends only on static content + a few state slices.

## Acceptance
- A move with the modal closed does not call `buildCardGraph` (verify via
  profiler or a `console.count`).
- Modal open → close still works.

## Related
- 026 (CardInfoProvider memoization)
