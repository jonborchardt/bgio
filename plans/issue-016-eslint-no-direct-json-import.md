# Issue 016 — ESLint missing the "no direct .json import outside src/data" rule

**Severity**: medium
**Area**: infra / lint
**Effort**: small
**Status**: not started

## Files
- `eslint.config.js` — has the no-`Math.random`-in-src rule, but no `.json` import restriction

## Problem
CLAUDE.md treats "Imports always go through the loaders ... never the raw JSON"
as a hard rule. ESLint enforces only `Math.random`. Today no offending imports
exist (verified), but a future PR can silently re-introduce them.

## Fix sketch
Add a `no-restricted-imports` rule with `patterns: ['*.json']` for files under
`src/`, with a carve-out for `src/data/**`. Optionally extend to forbid relative
imports of role folders crossing role boundaries (companion to issue 041's
cross-role import cleanup).

## Acceptance
- Lint catches a deliberate `import x from '../data/foo.json'` in any non-`src/data/` file.
- `npm run lint` continues to pass on current code.

## Related
- 015 (data barrel re-exports)
- 041 (cross-role import cleanup — could ride along)
