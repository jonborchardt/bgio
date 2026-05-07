# Issue 048 — `dev:server` / `server:dev` / `server:start` script aliasing duplication

**Severity**: low
**Area**: infra / dx
**Effort**: small
**Status**: not started

## Files
- `package.json:9, 23, 25`
- `README.md`, `CLAUDE.md` — alternate between `npm run server:dev` and `npm run dev:server`

## Problem
All three scripts point at `vite-node server/start.ts` (with a `--watch` only on
`dev:server`). Docs alternate between `npm run server:dev` and `npm run
dev:server`, causing confusion.

## Fix sketch
Pick one canonical name. Suggest `server:dev` (matches `server:build` /
`server:start`). Remove or alias the others. Update README + CLAUDE.md.

## Acceptance
- Single canonical name; docs consistent.
- Other names either removed or aliased with a one-line comment.

## Related
- 018 (doc drift)
