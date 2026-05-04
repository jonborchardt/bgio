// Defense redesign 3.3 — resolve animation context.
//
// The track resolver appends a `ResolveTrace` to `G.track.traces` (and
// updates `G.track.lastResolve`) every time a card flip resolves. This
// React context buffers those traces and feeds them through a small
// queue so the path overlay can animate one trace at a time without
// dropping frames when several flips arrive in close succession (e.g.
// the boss's multi-attack volley — each attack pushes its own trace).
//
// Lifecycle of one trace:
//   1. `pushTrace(trace)` is called from a `useEffect` watching
//      `G.track.lastResolve`.
//   2. When no animation is currently playing, the new trace becomes
//      `current` and a window timeout fires after `ANIMATION_DURATION_MS`
//      to advance the queue.
//   3. While an animation is playing, additional `pushTrace` calls land
//      on the internal queue and are dequeued in FIFO order. The visible
//      `current` slot is non-null for `ANIMATION_DURATION_MS` per trace.
//   4. When the queue empties, `current` returns to `null` and the
//      <PathOverlay> renders nothing.
//
// `noop` traces (boons / modifiers) skip the queue entirely — the strip
// is the visible signal for those, not the path overlay. The queue
// caps at `MAX_QUEUE_LENGTH` to defend against pathological bot loops
// (a malformed engine that pushes hundreds of traces in one tick would
// otherwise stall the UI for the duration of every queued animation).
//
// Pure presentational; no bgio plumbing here.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResolveTrace } from '../../game/track.ts';

/** Total duration of one trace's animation in milliseconds. Kept short
 *  per the plan ("≤ 500ms"); 350ms balances "you saw the path" with
 *  "the game continues immediately." Exposed for tests. */
export const ANIMATION_DURATION_MS = 350;

/** Hard cap on the internal queue. Real games will see ≤ 8 boss
 *  attacks per flip; a queue beyond ~16 means something upstream went
 *  wrong, and we drop the oldest entries rather than block the UI. */
export const MAX_QUEUE_LENGTH = 16;

export interface ResolveAnimationContextValue {
  /** The trace currently animating, or `null` when idle. */
  current: ResolveTrace | null;
  /** Push a trace onto the playback queue. Skips `noop` traces and
   *  duplicates by reference. The hook below `useResolveTrace` calls
   *  this from a `useEffect` watching `G.track.lastResolve`. */
  pushTrace: (trace: ResolveTrace) => void;
}

export const ResolveAnimationContext =
  createContext<ResolveAnimationContextValue>({
    current: null,
    pushTrace: () => undefined,
  });

export interface ResolveAnimationProviderProps {
  children: ReactNode;
}

/**
 * Provider that holds the animation queue + the currently-playing trace.
 * Mount this once near the top of the board so every consumer (the
 * overlay layer + the building grid) reads from the same queue.
 */
export function ResolveAnimationProvider({
  children,
}: ResolveAnimationProviderProps) {
  const [current, setCurrent] = useState<ResolveTrace | null>(null);
  // Queue lives in a ref so producers don't trigger renders just for
  // pushing (the visible-state change is driven by `setCurrent`).
  const queueRef = useRef<ResolveTrace[]>([]);
  // Identity-dedupe: tests / strict-mode double-renders re-fire the
  // `useEffect` watching `lastResolve`, which would otherwise enqueue
  // the same trace twice. Tracking the latest pushed reference covers
  // strict-mode without a structural compare.
  const lastPushedRef = useRef<ResolveTrace | null>(null);
  // Active timeout handle so cleanup can cancel a pending advance when
  // the provider unmounts mid-animation.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
    if (next === null) {
      timeoutRef.current = null;
      return;
    }
    timeoutRef.current = setTimeout(advance, ANIMATION_DURATION_MS);
  }, []);

  const pushTrace = useCallback(
    (trace: ResolveTrace) => {
      if (trace.outcome === 'noop') return;
      if (lastPushedRef.current === trace) return;
      lastPushedRef.current = trace;
      // Defensive cap.
      if (queueRef.current.length >= MAX_QUEUE_LENGTH) {
        queueRef.current.shift();
      }
      queueRef.current.push(trace);
      // If nothing is currently playing, kick the queue.
      if (timeoutRef.current === null && current === null) {
        advance();
      }
    },
    [advance, current],
  );

  // Cleanup: cancel any pending timeout when the provider unmounts so a
  // re-mount (e.g. fast-refresh) doesn't fire a stale advance.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const value = useMemo<ResolveAnimationContextValue>(
    () => ({ current, pushTrace }),
    [current, pushTrace],
  );

  return (
    <ResolveAnimationContext.Provider value={value}>
      {children}
    </ResolveAnimationContext.Provider>
  );
}

export interface ResolveTraceWatcherProps {
  /** The resolver writes the most recent trace into
   *  `G.track.lastResolve`. Pass it through here; the watcher pushes
   *  every new identity onto the animation queue. */
  lastResolve: ResolveTrace | undefined;
}

/**
 * Tiny effect-only component that watches `G.track.lastResolve` and
 * forwards new traces into the animation queue. Render this somewhere
 * inside <ResolveAnimationProvider> with the live `G.track.lastResolve`
 * as the prop — typically directly under the Board so it sees every
 * state update from the engine.
 */
export function ResolveTraceWatcher({
  lastResolve,
}: ResolveTraceWatcherProps) {
  const { pushTrace } = useContext(ResolveAnimationContext);
  useEffect(() => {
    if (lastResolve === undefined) return;
    pushTrace(lastResolve);
  }, [lastResolve, pushTrace]);
  return null;
}

/**
 * Convenience hook that derives a `{ pathKeys, impactKeys, firingUnitIDs }`
 * shape from the currently-animating trace. Returns `undefined` when
 * idle — the BuildingGrid forwards that straight to its `pathHighlight`
 * prop. Memoized on the active trace's identity so the consumer doesn't
 * recompute the Sets every render while the same animation plays.
 */
export const useActivePathHighlight = (): {
  pathKeys: ReadonlySet<string>;
  impactKeys: ReadonlySet<string>;
  firingUnitIDs: ReadonlySet<string>;
} | undefined => {
  const { current } = useContext(ResolveAnimationContext);
  return useMemo(() => {
    if (current === null) return undefined;
    const pathKeys = new Set<string>();
    for (const cell of current.pathTiles) {
      pathKeys.add(`${cell.x},${cell.y}`);
    }
    const impactKeys = new Set<string>(current.impactTiles);
    const firingUnitIDs = new Set<string>(current.firingUnitIDs);
    return { pathKeys, impactKeys, firingUnitIDs };
  }, [current]);
};
