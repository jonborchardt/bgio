# Issue 001 — `render.yaml` is missing entirely

**Severity**: critical
**Area**: infra / deploy
**Effort**: small
**Status**: not started

## Files
- (missing) `render.yaml` at repo root
- `README.md:124` — references it
- `server/README.md:36, 42, 50` — references it
- `.github/workflows/deploy-server.yml:24` — `paths:` filter targets it
- `server/index.ts:135` — comment claims `render.yaml` pins `STORAGE_KIND=sqlite`

## Problem
Three workflows, two README files, and the server bootstrap all assume a Render
blueprint that does not exist in the working tree. Render cannot be re-provisioned
from the repo; the persistent disk + `STORAGE_KIND=sqlite` env is not declared in
source; `deploy-server.yml`'s `paths:` filter will never trigger.

## Fix sketch
Add `render.yaml` describing the docker web service, `/data` disk mount, env vars
(`PORT`, `STORAGE_KIND=sqlite`, `SQLITE_PATH=/data/settlement.sqlite`, `NODE_ENV=production`,
`ALLOWED_ORIGINS`), and pin `dockerfilePath: server/Dockerfile`. After committing,
test by detaching + reattaching the Render service from the repo.

## Acceptance
- `render.yaml` exists and validates with Render's blueprint schema.
- `deploy-server.yml`'s `paths:` filter triggers on changes to `render.yaml`.
- Render service can be torn down and re-created from the blueprint.

## Related
- 002 (auth not wired — also blocks safe networked deploy)
- 003 (bots config missing — required for default 1H+3B match)
- 006 (CORS / origins also needs to be declared, both as env var here and in code)
