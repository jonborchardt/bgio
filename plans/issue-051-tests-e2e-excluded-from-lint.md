# Issue 051 — `tests-e2e/` and `playwright.config.ts` excluded from lint

**Severity**: low
**Area**: infra / lint
**Effort**: small
**Status**: not started

## Files
- `eslint.config.js:13-19`

## Problem
Ignoring `tests-e2e` and `playwright.config.ts` was justified before
`@playwright/test` was an installed devDep; it is now in `package.json`. Lint
should cover this surface.

## Fix sketch
Remove the ignore entries. Run `npm run lint` and fix any new findings (likely
zero, since the smoke spec is small).

## Acceptance
- `tests-e2e/` and `playwright.config.ts` are linted.
- `npm run lint` passes.

## Related
- (none)
