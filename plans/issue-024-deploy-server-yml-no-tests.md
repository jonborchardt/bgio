# Issue 024 — `deploy-server.yml` does not run unit/lint tests before triggering deploy

**Severity**: medium
**Area**: ci / deploy
**Effort**: small
**Status**: not started

## Files
- `.github/workflows/deploy-server.yml:35-52`

## Problem
The workflow's comment says it "fails loudly on a server build break before
Render attempts deploy." But it only runs `npm run server:build` (tsc typecheck).
A passing `ci.yml` is not gated against `deploy-server.yml`; if `ci.yml` (which
runs tests + lint) is red and `deploy-server.yml` is green, Render will still
deploy.

## Fix sketch
1. Add `npm test -- tests/server` (or a dedicated `npm run test:server` script)
   to `deploy-server.yml`.
2. Add `npm run lint -- server` (or the eslint config equivalent that scopes to
   `server/`).
3. Optionally make Render gate deploy on a "CI green" status check via Render's
   GitHub integration.

## Acceptance
- A red unit test or lint error in `server/` blocks `deploy-server.yml`.
- Render does not auto-deploy when `ci.yml` is failing on `main`.

## Related
- 028 (CI: no networked end-to-end smoke)
