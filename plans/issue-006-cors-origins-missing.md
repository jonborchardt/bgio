# Issue 006 — Server is missing `origins` (CORS) configuration

**Severity**: high
**Area**: server / security
**Effort**: small
**Status**: not started

## Files
- `server/index.ts:60-78` — `Server({ games, db })` has no `origins`
- `server/auth/routes.ts:174` — sets `access-control-allow-origin: *` unconditionally
- `tests/server/boot.test.ts` — emits "Server `origins` option is not set" warning at boot

## Problem
bgio 0.50.x emits a startup warning telling you to set `origins`. In production
the GH Pages SPA (different origin) talking to Render will be either fully open
(current behavior) or rejected — neither acceptable. Compounding this, the auth
routes hand-roll CORS with `*`, so even if the bgio Server tightened its origins
the auth surface would remain open.

## Fix sketch
- Pass `origins: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5179']`
  to `Server({ games, db, origins })`.
- Replace `routes.ts` `*` with the same allow-list, validating `Origin` against it.
- Document `ALLOWED_ORIGINS` in `render.yaml` (issue 001) and in the
  `.env.example` template (issue 050).

## Acceptance
- Booting the server in tests no longer emits the "origins" warning.
- A CORS preflight from an unlisted origin is rejected on both bgio + auth routes.
- Production deploy lists `https://<gh-pages-domain>` as an allowed origin.

## Related
- 001 (`render.yaml` declares the env var)
- 050 (`.env.example` declares it for dev)
