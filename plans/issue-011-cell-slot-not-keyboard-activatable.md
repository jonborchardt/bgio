# Issue 011 — `<Box role="button">` cells are not keyboard-activatable

**Severity**: high
**Area**: ui / accessibility
**Effort**: small
**Status**: not started

## Files
- `src/ui/domestic/CellSlot.tsx:168-188`

## Problem
The cell wraps a `Box` with `role="button"` + `tabIndex={clickable ? 0 : -1}` but
never wires `onKeyDown` to fire `onClick` on Enter/Space. Keyboard users can't
place buildings or station units. This is a real a11y regression on the central
village grid — the most-used interactive surface in the game.

## Fix sketch
Replace the `Box` with `ButtonBase` from `@mui/material` — it handles keyboard
activation, ripple, and focus indicators natively. If the visual layering needs
something `ButtonBase` won't provide, add an `onKeyDown` that calls `onClick` on
`Enter`/`' '` and uses `event.preventDefault()` for Space.

## Acceptance
- Tab into the village grid focuses the first cell, arrow / tab navigates cells.
- Enter and Space activate the cell (place building / station unit).
- A test (could be RTL) confirms keyDown 'Enter' triggers the same handler as
  click.

## Related
- 026 (overall a11y / keyboard pass — same area)
