# Issue 045 — Dockerfile lacks `HEALTHCHECK` and runs as root

**Severity**: medium
**Area**: infra / security
**Effort**: small
**Status**: not started

## Files
- `server/Dockerfile:46-72`

## Problem
Multi-stage Node 20 alpine is good. Missing:
- No `HEALTHCHECK` — Render's free tier auto-restarts on failure but a
  healthcheck would make local docker / non-Render runs more reliable.
- Container runs as root throughout. `/data` is implicitly root-owned —
  hardening hygiene.
- `CMD ["npx", "vite-node", ...]` shells through npx unnecessarily, adding
  process overhead per restart.

## Fix sketch
1. Add `HEALTHCHECK CMD wget -qO- http://127.0.0.1:8000/games || exit 1` (or use
   curl).
2. Add `USER node` after COPY steps with a `chown -R node:node /app /data`
   adjustment.
3. Resolve vite-node's bin path and call directly (`CMD ["node",
   "node_modules/vite-node/dist/cli.js", "server/start.ts"]` or similar) to
   avoid npx.

## Acceptance
- `docker build` + `docker run` still works.
- `docker inspect` shows non-root user.
- Healthcheck reports healthy/unhealthy correctly.

## Related
- 001 (render.yaml — healthcheck path may also be declared there)
