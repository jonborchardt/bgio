# Issue 040 — `playerView` may not redact every seat in `events.hands[color]`

**Severity**: medium
**Area**: game / privacy
**Effort**: small
**Status**: not started

## Files
- `src/game/playerView.ts:200-213`

## Problem
The loop iterates roles and skips the viewer-held role. For a non-viewer role,
it looks up that role's seat via `seatOfRole` and redacts only that seat's hand.
The inner `if (seat === null) continue` only handles missing assignments. If
multiple seats appear in `nextHands[color]` (test fixtures or future multi-seat-
per-role configs), other entries are *not* redacted.

## Fix sketch
Rewrite the loop to iterate `Object.keys(nextHands[color])` directly: for every
seat in the color map, redact unless that seat's role is in the viewer's
`localRoles`. This is more defensive and handles N-seats-per-role correctly.

## Acceptance
- Synthetic test: seed a state where `nextHands.green = { '0': [...], '2': [...] }`
  and viewer is seat '1' (chief). Both seats' hands must be redacted.
- Existing per-seat redaction tests still pass.

## Related
- (none direct)
