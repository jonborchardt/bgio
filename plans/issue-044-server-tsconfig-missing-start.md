# Issue 044 — `server/tsconfig.json` missing `start.ts` from `include`

**Severity**: medium
**Area**: infra / typecheck
**Effort**: small
**Status**: not started

## Files
- `server/tsconfig.json:43-52`
- `server/start.ts`
- `server/Dockerfile:72` — runs `vite-node server/start.ts` at boot

## Problem
The `npm run server:build` step (`tsc -p server --noEmit`) — used by CI as the
server-deploy gate — never typechecks `start.ts`. A TS error there would only
surface at container boot.

## Fix sketch
Add `"start.ts"` to the `include` list in `server/tsconfig.json`. Run
`npm run server:build` to verify.

## Acceptance
- `npm run server:build` typechecks `start.ts`.
- A deliberate TS error in `start.ts` fails the deploy workflow.

## Related
- 024 (deploy-server.yml hardening)
