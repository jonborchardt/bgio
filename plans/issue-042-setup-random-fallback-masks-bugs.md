# Issue 042 — Random fallback in `setup.ts` masks missing-plugin bugs in production

**Severity**: low-medium
**Area**: game / engine
**Effort**: medium
**Status**: not started

## Files
- `src/game/setup.ts:99-103, 65`
- `src/game/roles/chief/flipTrack.ts:61-65`
- `src/game/roles/defense/play.ts:123-127`
- `src/game/roles/chief/playGoldEvent.ts:90-94`

## Problem
Multiple hot paths create a "fallback identity-shuffle" `BgioRandomLike` when
bgio's `random` plugin is missing. In production bgio always supplies the
plugin, so this is "test ergonomics." But identity-shuffle is silently
non-random — every match would deal cards in JSON order — which would hide a
real "plugin not wired" bug at runtime.

## Fix sketch
- In production builds (`process.env.NODE_ENV !== 'test'`), throw on missing
  plugin instead of returning identity-shuffle.
- Tests that need the fallback should pass an explicit deterministic stub via
  the `RandomAPI` constructor.

## Acceptance
- A deliberate "delete `ctx.random`" in dev mode throws loudly instead of
  silently dealing in JSON order.
- Tests still pass with explicit stubs.

## Related
- 034 (replay determinism — same area)
