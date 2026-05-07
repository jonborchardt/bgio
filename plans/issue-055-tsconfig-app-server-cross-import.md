# Issue 055 — `tsconfig.app.json` excludes `server/` but server tests cross-import

**Severity**: low
**Area**: infra / typecheck
**Effort**: small
**Status**: not started

## Files
- `tsconfig.app.json:35` — `"exclude": ["server"]`, includes `tests`
- `tests/server/*.test.ts` — import directly from `../../server/auth/...`

## Problem
The tsconfig graph re-includes server source through the test imports (it
works), but it's confusing: the "app" project type-checks server source via the
test back-door without the server's own tsconfig settings (including
`"types": []`).

## Fix sketch
Either:
- Move server tests to the server tsconfig project (separate test config).
- Or leave a comment in `tsconfig.app.json` documenting the intentional
  cross-project bridge.

## Acceptance
- Either: server tests live under server's tsconfig.
- Or: documented bridge with a comment.

## Related
- 044 (server tsconfig include cleanup)
