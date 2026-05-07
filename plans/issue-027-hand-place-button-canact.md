# Issue 027 — Domestic Hand's Place button doesn't gate on `canAct`

**Severity**: medium
**Area**: ui / game-state
**Effort**: small
**Status**: not started

## Files
- `src/ui/domestic/Hand.tsx:85-103, 196-225`

## Problem
`canAct` is a `HandProps` field but isn't passed to the Place button for
buildings — only `affordable` gates it (line 149: `const enabled = affordable;`).
When the seat is parked outside `domesticTurn` the player can still click Place
to "select" a card and arm placement state in the board, even though
`domesticBuyBuilding` would `INVALID_MOVE`.

## Fix sketch
`const enabled = canAct && affordable;`. Verify the placement-arming UI also
respects `canAct` so out-of-turn players can't enter a half-armed state.

## Acceptance
- When seat is not in `domesticTurn`, Place buttons are disabled and the
  placement-arm overlay does not appear on click.
- A focused test (RTL) covers the disabled-state.

## Related
- 029 (DomesticPanel UI test it.todos)
