// Defense redesign 3.9 — e2e smoke spec.
//
// Two checks run sequentially against the dev server:
//
//   1. Board renders. Anchored on the `Settlement` heading + the global
//      track-strip region — both ship from the post-1.4 board and are
//      stable across 3.9 (the heading text changes at most via a future
//      rename pass; the region role is the canonical landmark).
//
//   2. Full match end-to-end. The `#fuzz` page (`src/fuzz/FuzzPage.tsx`)
//      mounts a headless `boardgame.io/client` Client + a 4-seat
//      RandomBot driver and steps the engine until `gameover` fires
//      (or the harness's `MAX_MOVES` cap trips). The spec waits for the
//      page's `data-fuzz-state` attribute to flip to `"complete"` and
//      asserts the outcome is `win` or `timeUp` (both are valid game-
//      end states under D25 / spec §1) — never `error` or `cap`.
//
// The fuzz page is dev-only (App.tsx gates on `import.meta.env.DEV`),
// so the spec runs against `npm run dev` (Vite's dev server, which
// already drives Playwright's `webServer` config — see playwright.config.ts).

import { expect, test } from '@playwright/test';

test('board renders', async ({ page }) => {
  await page.goto('/');
  // Heading is the most stable anchor for "the board mounted." It's
  // rendered by Board.tsx unconditionally, doesn't move under any of
  // the polish edits in 3.9, and survives the future rename pass
  // (only the text would change, and we'd update the spec then).
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settlement' }),
  ).toBeVisible();
  // Sanity-check the track strip — its presence proves the Phase-2
  // engine state shipped to the UI and the 3.x components rendered.
  await expect(page.getByTestId('track-strip')).toBeVisible();
});

test('fuzz harness drives a full 4-player match to a terminal outcome', async ({
  page,
}) => {
  // Bump the test timeout for this one — a full game can take 30–60s
  // of in-browser bot stepping under the dev server.
  test.setTimeout(120_000);

  await page.goto('/#fuzz?seed=e2e-smoke-1');

  const fuzzPage = page.getByTestId('fuzz-page');
  await expect(fuzzPage).toBeVisible();

  // Wait until the harness flips `data-fuzz-state` to `"complete"` (or
  // `"error"` — caught by the assertion below). The harness updates
  // React state on every move; once the engine returns `gameover` the
  // status flips and the attribute settles. We give it 90s to walk a
  // full ~80-round match.
  await expect(fuzzPage).toHaveAttribute('data-fuzz-state', 'complete', {
    timeout: 90_000,
  });

  const outcome = await fuzzPage.getAttribute('data-fuzz-outcome');
  // The fuzz harness exposes one of: 'win' (boss resolved), 'timeUp'
  // (turn cap reached), 'cap' (MAX_MOVES safety net), or 'error'
  // (the engine threw). 'win' and 'timeUp' are both valid — D25 says
  // the run records a score either way. 'cap' or 'error' fail the
  // smoke.
  expect(['win', 'timeUp']).toContain(outcome);

  const rounds = Number(await fuzzPage.getAttribute('data-fuzz-rounds'));
  expect(rounds).toBeGreaterThan(0);
});
