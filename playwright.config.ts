// 12.5 — Playwright config for the dev-server-driven smoke spec.
//
// `webServer.command` is `npm run dev` so the spec runs against the
// same Vite-served bundle a developer sees. `reuseExistingServer: true`
// lets the spec attach to an already-running dev server (faster local
// iteration) without re-spawning. CI always boots a fresh server (no
// existing one to reuse).
//
// `testDir: 'tests-e2e'` keeps the e2e specs distinct from the
// `tests/**/*.test.ts` Vitest suite — Playwright and Vitest both
// match on `*.spec.ts` glob patterns, so we segregate by directory.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests-e2e',
  // Each test gets up to 60s — the dev server cold-starts in ~5-10s
  // on most boxes and we don't want flaky failures during boot.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // Single browser project today. Multi-browser / multi-tab specs land
  // alongside the networked-multiplayer e2e in a follow-up.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:5179',
    // Trace + screenshot only on failure to keep the artifact size sane.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5179,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
