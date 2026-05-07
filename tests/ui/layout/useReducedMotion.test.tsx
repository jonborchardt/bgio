// Defense redesign 3.9 — useReducedMotion hook tests.
//
// jsdom doesn't ship a real `matchMedia` implementation; we stub one
// before each test so the hook can read the preferred-motion query and
// react to changes via the `change` event. Two flows covered:
//
//   1. Initial value — the hook reflects whatever `matchMedia(query).matches`
//      returned at first mount.
//   2. Live updates — when the OS preference flips, the registered
//      listener runs and the hook re-renders with the new value.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from './renderHook.ts';
import { useReducedMotion } from '../../../src/ui/layout/useReducedMotion.ts';

// Tell React 19 we're driving rendering inside an `act` envelope so
// state updates flush deterministically. Without this flag React logs
// a warning to stderr; the warning is benign but noisy in the run log.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface FakeMediaQueryList {
  matches: boolean;
  media: string;
  listeners: Array<(e: { matches: boolean; media: string }) => void>;
  addEventListener: (
    type: 'change',
    cb: (e: { matches: boolean; media: string }) => void,
  ) => void;
  removeEventListener: (
    type: 'change',
    cb: (e: { matches: boolean; media: string }) => void,
  ) => void;
}

const fakeMq = (matches: boolean): FakeMediaQueryList => {
  const mq: FakeMediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    listeners: [],
    addEventListener: (_type, cb) => {
      mq.listeners.push(cb);
    },
    removeEventListener: (_type, cb) => {
      mq.listeners = mq.listeners.filter((l) => l !== cb);
    },
  };
  return mq;
};

const installMatchMedia = (initial: boolean): { mq: FakeMediaQueryList } => {
  const mq = fakeMq(initial);
  (window as unknown as { matchMedia: (q: string) => FakeMediaQueryList }).matchMedia =
    () => mq;
  return { mq };
};

describe('useReducedMotion (defense redesign 3.9)', () => {
  let savedMatchMedia: unknown;
  beforeEach(() => {
    savedMatchMedia = (window as unknown as { matchMedia?: unknown }).matchMedia;
  });
  afterEach(() => {
    (window as unknown as { matchMedia: unknown }).matchMedia = savedMatchMedia;
  });

  it('returns false when the OS preference is "no preference"', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when the OS preference is reduced', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the OS preference changes mid-session', () => {
    const { mq } = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      mq.matches = true;
      for (const l of mq.listeners) {
        l({ matches: true, media: mq.media });
      }
    });
    expect(result.current).toBe(true);
  });
});
