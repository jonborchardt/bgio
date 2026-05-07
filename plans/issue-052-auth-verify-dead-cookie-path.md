# Issue 052 — `verify` rotates tokens but doesn't issue HTTP-Only cookie; dead cookie path

**Severity**: low
**Area**: server / security
**Effort**: medium
**Status**: not started

## Files
- `server/auth/routes.ts:214-228` — returns `{ token }` in JSON body
- `server/auth/middleware.ts:50-54` — reads `bgio_token` cookie that nobody sets

## Problem
`middleware.ts` reads a `bgio_token` cookie as a fallback to the bearer header,
but no code path ever sets that cookie — `routes.ts:227` returns `{ token }` in
the JSON body and the SPA stores it in `localStorage`. localStorage tokens are
vulnerable to XSS. The dead cookie path is also a footgun: a future contributor
might assume cookies are wired and rely on them.

## Fix sketch
Either:
- (a) Remove the dead cookie branch from `middleware.ts`. localStorage is V1
  acceptable risk for a co-op game.
- (b) Actually set an HTTP-only `Secure; SameSite=Lax` cookie on login + verify
  and prefer it. Delete `localStorage` storage in the SPA. CSRF-safe via SameSite.

(b) is the right long-term fix; (a) is fine for V1.

## Acceptance
- Either: dead cookie branch removed and SPA continues to work.
- Or: cookie set + SPA reads from cookie + tests cover both auth paths.

## Related
- 002 (auth correctness)
- 023 (auth rate-limit)
