// 12.5 — Smoke spec: boot the app and verify the board renders.
//
// We anchor on `data-testid="board-shell"` (added to BoardShell in
// 09.1). Anchoring on a stable testid keeps the spec resilient to
// copy / role-name churn while still being a decent "the app
// rendered" signal.

import { expect, test } from '@playwright/test';

test('board renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board-shell')).toBeVisible();
});
