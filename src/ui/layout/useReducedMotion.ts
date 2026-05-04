// Defense redesign 3.9 — reduced-motion preference hook.
//
// A small, dependency-free wrapper around the
// `(prefers-reduced-motion: reduce)` media query. Components that paint
// short-lived transitions (PathOverlay, CenterBurnBanner, BuildingTile
// damage / repair flash, TrackCardView slide) read this hook to decide
// whether to suppress the keyframe animations.
//
// Why a hook (instead of inlining `matchMedia`):
//   - keeps the surface area testable (tests can mock window.matchMedia
//     once and the hook returns the agreed value everywhere).
//   - centralises the SSR fallback (matchMedia is undefined on the
//     server / under `react-dom/server`, so the hook returns `false`
//     there — the static markup keeps its motion).
//   - keeps Hooks Rule of Hooks happy by always running, regardless of
//     whether the consumer ends up reading it.
//
// Tabletop-playable test (CLAUDE.md): no — this is purely a UI nicety.
// The reduced-motion path strips animation but keeps every move /
// affordance the table can perform.

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const readInitial = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
};

/**
 * Returns `true` when the user has asked for reduced motion via their
 * OS / browser preferences. SSR-safe (returns `false` on the server).
 *
 * The subscription is set up in a useEffect so React strict-mode
 * double-mount doesn't leak listeners — every effect cleanup detaches.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => readInitial());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    // Sync the latest value immediately in case the OS preference
    // changed between the initial render and the effect run.
    setReduced(mq.matches);
    const listener = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    // Modern browsers expose `addEventListener`; older Safari uses
    // `addListener`. Support both for breadth, since this hook is
    // imported into every animated component.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', listener);
      return () => {
        mq.removeEventListener('change', listener);
      };
    }
    // Fallback for older browsers — `as any` because the legacy API is
    // not on the modern MediaQueryList type.
    const legacy = mq as unknown as {
      addListener: (cb: (e: MediaQueryListEvent) => void) => void;
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener(listener);
    return () => {
      legacy.removeListener(listener);
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
