# Issue 043 — `tsx` devDep is obsolete; remove

**Severity**: low
**Area**: infra
**Effort**: small
**Status**: not started

## Files
- `package.json:53` — `"tsx": "^4.20.0"`
- `server/Dockerfile:12-17` — comment notes tsx is unusable as a server runner
- `scripts/dev-full.md:13-15` — same
- `.github/workflows/deploy-server.yml:48` — stale comment "emit is handled at runtime by tsx"

## Problem
Per CLAUDE.md, "Server runner is `vite-node`, not `tsx`." vite-node replaced tsx
because tsx 4.x mis-resolves bgio subpath imports. No script invokes tsx
anywhere; it's dead weight in node_modules and a footgun for new contributors
who reach for it.

## Fix sketch
1. Remove `tsx` from `devDependencies`.
2. Update `deploy-server.yml:48` comment to mention vite-node.
3. Run `npm install` to refresh lockfile.

## Acceptance
- `package.json` no longer lists `tsx`.
- `npm test` + `npm run typecheck` + `npm run server:build` clean.
- Grep for `tsx` in scripts returns nothing relevant.

## Related
- 018 (doc drift cleanup)
