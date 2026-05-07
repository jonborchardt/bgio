// Defense redesign 3.9 — minimal renderHook + act helpers.
//
// `@testing-library/react` is not a dependency in this repo (see
// `tests/ui/cards/TechCard.test.tsx`'s comment), but a few of the 3.9
// polish tests need to drive a hook through state changes. This module
// is the smallest viable shim: it mounts a one-cell test component
// inside a real DOM, captures the hook's return on every render, and
// exposes an `act` helper that flushes React updates.
//
// Out of scope: queries, fireEvent, async-flow helpers. Anything more
// than a hook + act belongs in @testing-library when we eventually pull
// it in. For now, the helpers here cover the 3.9 unit tests without
// taking on a new dependency.

import { createRoot, type Root } from 'react-dom/client';
import { act as reactAct } from 'react';
import { createElement, type ReactNode } from 'react';

export interface RenderHookResult<T> {
  /** The hook's most recent return value. Updated synchronously after
   *  every render. */
  result: { current: T };
  /** Tear down the rendered tree. Tests can call this to free the DOM
   *  node when they want to assert on cleanup behavior. */
  unmount: () => void;
}

/**
 * Render a hook inside a freshly-mounted root and return a live ref to
 * its current value. The rendered component does nothing visually — its
 * sole job is to call the hook and stash the result on every render.
 */
export const renderHook = <T,>(hook: () => T): RenderHookResult<T> => {
  const result = { current: undefined as unknown as T };
  let root: Root | null = null;

  const HookHost = (): ReactNode => {
    result.current = hook();
    return null;
  };

  const container = document.createElement('div');
  document.body.appendChild(container);

  // Wrap in `act` so React 19 flushes the initial render before we
  // hand control back to the test.
  reactAct(() => {
    root = createRoot(container);
    root.render(createElement(HookHost));
  });

  return {
    result,
    unmount: () => {
      reactAct(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

/**
 * Re-export of React's `act` so tests can drive synchronous state
 * changes without importing from `react` directly. Wraps a callback in
 * the act envelope and flushes renders before returning.
 */
export const act = (fn: () => void | Promise<void>): void | Promise<void> =>
  reactAct(fn);
