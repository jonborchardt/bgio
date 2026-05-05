// Defense redesign 3.3 — resolve animation provider components.
//
// The track resolver appends a `ResolveTrace` to `G.track.traces` (and
// updates `G.track.lastResolve`) every time a card flip resolves. This
// file holds the React components that own the playback queue:
//
//   - <ResolveAnimationProvider> — buffers traces and surfaces the
//     currently-animating one through `ResolveAnimationContext`.
//   - <ResolveTraceWatcher> — a thin effect-only adapter that pushes
//     `G.track.lastResolve` updates into the provider.
//
// The context object, derived hook, and tunable constants live in
// `./resolveAnimation.ts` (the `react-refresh/only-export-components`
// rule requires non-component exports to sit in a separate module).
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

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResolveTrace } from '../../game/track.ts';
import {
  ANIMATION_DURATION_MS,
  MAX_QUEUE_LENGTH,
  ResolveAnimationContext,
  type ResolveAnimationContextValue,
} from './resolveAnimation.ts';

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
