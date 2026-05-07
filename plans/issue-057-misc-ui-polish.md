# Issue 057 — Miscellaneous UI polish (bundled)

**Severity**: low
**Area**: ui
**Effort**: small (each item)
**Status**: not started

This issue bundles small UI polish items individually too small to track
separately.

## Items

### a. `TrackStrip` reveals upcoming-card kind as boss
- File: `src/ui/track/TrackStrip.tsx:65-89, 269-277`
- `data-track-card-boss="true"` and `BOSS` label render on the upcoming boss
  tile. Likely intentional (boss position is public at a real table per current
  rules). Add a one-line confirming comment so future readers don't second-guess.

### b. Positional `key={i}` / `key={slotIndex}` in lists
- Files: `src/ui/domestic/Hand.tsx:168-178, 256-266`, `src/ui/cards/PlayableHand.tsx:169-178`,
  `src/ui/library/LibraryRow.tsx:103-119`, `src/ui/track/TrackStrip.tsx:99-135`
- Replace positional keys with stable string keys (`'need'` / `'turn'` / `'note'`
  for tooltips; `card?.name ?? 'empty:N'` for library slots).

### c. `DevSidebar` shows `currentPlayer` not `activeSeat`
- File: `src/ui/layout/DevSidebar.tsx:163-168`
- Pull `pickActiveSeat` from `src/ui/layout/activeSeat.ts` and pass
  `phase`/`activePlayers`/`G.othersDone` from Board. Dev-only impact.

### d. `RelationshipsGraph` uses inline `style={{ opacity: 0 }}` on Handles
- File: `src/ui/relationships/CardNode.tsx:29-33`
- react-flow library constraint, not a project-rule violation. Optionally use
  `visibility: hidden` via a styled wrapper.

### e. `RequestHelpButton` SVG with raw style
- File: `src/ui/requests/RequestHelpButton.tsx:30-53`
- `style={{ display: 'block' }}` could become `<Box component="svg" sx={{ display: 'block' }}>`.

### f. `main.tsx` targets bgio internal class via `& .bgio-client`
- File: `src/main.tsx:32`
- Brittle if bgio renames the wrapper. Wrap `<App />` in a sized `<Box>` so the
  constraint doesn't depend on bgio's DOM.

### g. `Board.tsx` allocates inline arrows per render
- File: `src/Board.tsx:179-189, 230-244`
- `handlePlaceBuilding` / `handlePickUnitCell` recreated each render. Wrap in
  `useCallback` so memoized children don't bust.

### h. `window.location.reload()` for hash-route preview pages
- Files: `src/ui/layout/DevSidebar.tsx:43-55`, `src/Board.tsx:213`
- Replace with popstate listener + `setState`. Dev-only impact, low priority.

## Acceptance
- Each item either fixed or moved to its own issue with rationale.

## Related
- 010 (theme tokens)
- 011 (a11y / keyboard activation)
- 026 (perf companion)
