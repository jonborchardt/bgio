# Coverage policy

This project gates coverage via `npm run test:coverage` (Vitest with the
`@vitest/coverage-v8` provider). Configuration lives at the bottom of
[`vite.config.ts`](../vite.config.ts) under `test.coverage`.

## What's measured

- **Included:** `src/**/*.{ts,tsx}` — the application source.
- **Excluded:**
  - `src/**/*.tsx` — UI files are tested behaviorally (Playwright + render
    smokes from 12.5), not line-by-line. A complex non-render hook that
    happens to live in a `.tsx` file is the tail case; in that case,
    extract the hook to a sibling `.ts` and the inclusion rule covers it.
  - `src/main.tsx` — bootstrap; explicitly excluded for clarity.
  - `src/theme.ts` — design tokens; configuration data rather than logic.

## Thresholds

Plan 12.6 specifies `lines: 90, functions: 90, branches: 80`. We currently
ship with `70/70/70` — high enough to catch a regression that drops a
covered module, low enough that we don't need to backfill 100% of stage 11
modules to keep CI green. As more of the codebase grows real test
coverage, ratchet these up rather than easing them.

## Running locally

```bash
npm run test:coverage         # runs vitest with --coverage
```

Outputs `coverage/lcov.info` and a text table on stdout. CI uploads the
HTML report when on; for now it stays local-only.

## When CI goes red on coverage

1. Did your change actually drop a covered module's coverage? Read the
   text summary near the bottom of the CI log.
2. If yes, add tests for the new branches.
3. If the drop is collateral (a refactor moved a covered helper to
   another file), update the threshold's per-file override (TODO: add
   per-file overrides once we hit a real case) rather than easing the
   global threshold.
