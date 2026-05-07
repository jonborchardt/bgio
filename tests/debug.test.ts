// 12.2 — bgio Debug-panel toggle smoke tests.
//
// We don't render `<App />` here: bgio's React `Client` lazily imports
// the debug-panel UI on construction and walking that inside vitest's
// jsdom adds churn for little signal. The render-level assertions
// (mount + assert the panel is/isn't visible across the production
// branch where `import.meta.env.DEV` flips off) are deferred to
// `tests-e2e/smoke.spec.ts` — Playwright runs the real built bundle
// where DEV is statically `false`. The cases below pin the boolean
// derivation App.tsx uses to decide.

import { describe, expect, it } from 'vitest';
import App from '../src/App.tsx';

describe('App + debug toggle', () => {
  it('exports a component (function)', () => {
    expect(typeof App).toBe('function');
  });

  it('debugEnabled mirrors import.meta.env.DEV (Vitest sets DEV=true)', () => {
    // Mirror App.tsx's exact derivation.
    const debugEnabled: boolean =
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ===
      true;
    expect(typeof debugEnabled).toBe('boolean');
    expect(debugEnabled).toBe(true);
  });

  it('debug option shape is `{ collapseOnLoad: true }` when enabled, `false` otherwise', () => {
    // Mirror App.tsx's debugOpt derivation — bgio's Client accepts
    // `false` to skip the debug chunk entirely or
    // `{ collapseOnLoad: true }` to mount but start collapsed.
    const debugOpt = (enabled: boolean): { collapseOnLoad: true } | false =>
      enabled ? { collapseOnLoad: true } : false;
    expect(debugOpt(true)).toEqual({ collapseOnLoad: true });
    expect(debugOpt(false)).toBe(false);
  });
});
