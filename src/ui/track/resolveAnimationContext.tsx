// Resolve animation provider components.
//
// The track resolver appends a `ResolveTrace` to `G.track.traces` (and
// updates `G.track.lastResolve`) every time a card flip resolves. This
// file holds the React components that own the playback queue:
//
//   - <ResolveAnimationProvider> — buffers traces, decomposes each into
//     `ResolveStep`s (enter → per-unit fire → per-tile impact → optional
//     centerBurn), and walks the table through them one phase at a time
//     via the auto-advance timer + the HUD's "Continue" button.
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
//   2. When no animation is currently playing, the new trace is
//      promoted to `current`, decomposed into steps, and step 0 becomes
//      `currentStep`. The auto-advance timer fires after
//      `STEP_DURATION_MS` to call `advance()`.
//   3. `advance()` either steps within the trace or, when at the last
//      step, drains the next queued trace. When the queue empties,
//      `current` returns to `null`.
//   4. The HUD's "Continue" button calls `advance()` directly,
//      cancelling the timer and pacing the table manually.
//
// `noop` traces (boons / modifiers) skip the queue entirely — the strip
// is the visible signal for those, not the path overlay. `decomposeTrace`
// also returns `[]` for path-less traces; the queue's drain logic skips
// past those silently rather than emitting an empty step.
//
// Pure presentational; no bgio plumbing here.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResolveTrace } from '../../game/track.ts';
import {
  STEP_DURATION_MS,
  MAX_QUEUE_LENGTH,
  ResolveAnimationContext,
  type ResolveAnimationContextValue,
} from './resolveAnimation.ts';
import { decomposeTrace, type ResolveStep } from './resolveSteps.ts';

export interface ResolveAnimationProviderProps {
  children: ReactNode;
}

interface ActivePlayback {
  trace: ResolveTrace;
  steps: ResolveStep[];
  index: number;
}

/**
 * Provider that holds the playback queue + the currently-playing
 * trace/step. Mount this once near the top of the board so every
 * consumer (the overlay layer + the building grid + the step banner)
 * reads from the same source.
 */
export function ResolveAnimationProvider({
  children,
}: ResolveAnimationProviderProps) {
  const [playback, setPlayback] = useState<ActivePlayback | null>(null);
  // Mirror of `playback` for synchronous reads inside the timer / push
  // callbacks. setState is batched, so reading from the closure-captured
  // `playback` after `setPlayback(...)` would still see the prior value
  // — we keep a ref in sync and read from it.
  const playbackRef = useRef<ActivePlayback | null>(null);
  const writePlayback = useCallback((next: ActivePlayback | null) => {
    playbackRef.current = next;
    setPlayback(next);
  }, []);
  // Queue of traces awaiting their turn. Lives in a ref so producers
  // don't trigger a render just for pushing — the visible-state change
  // is driven by `setPlayback`.
  const queueRef = useRef<ResolveTrace[]>([]);
  // Identity-dedupe: tests / strict-mode double-renders re-fire the
  // `useEffect` watching `lastResolve`, which would otherwise enqueue
  // the same trace twice.
  const lastPushedRef = useRef<ResolveTrace | null>(null);
  // Active timeout handle so cleanup can cancel a pending advance when
  // the provider unmounts mid-animation or the user clicks Continue.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest `advance` impl held in a ref so the auto-advance timer can
  // call the current closure without becoming a useCallback dependency
  // of its own scheduler.
  const advanceRef = useRef<() => void>(() => undefined);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Decompose a trace and start playback at step 0. When the trace
  // produces no steps (path-less / noop slipped past the filter) we
  // signal failure to the caller so it can keep draining.
  const beginPlayback = useCallback((trace: ResolveTrace): ActivePlayback | null => {
    const steps = decomposeTrace(trace);
    if (steps.length === 0) return null;
    return { trace, steps, index: 0 };
  }, []);

  // Pull the next playable trace out of the queue and return its
  // initial playback record. Skips traces that decompose to zero steps.
  // Returns `null` when the queue has nothing usable left.
  const dequeueNextPlayback = useCallback((): ActivePlayback | null => {
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      const pb = beginPlayback(next);
      if (pb !== null) return pb;
    }
    return null;
  }, [beginPlayback]);

  // Schedule the auto-advance timer. Pulled out of `advance` so the
  // setPlayback updater stays pure (no side effects beyond returning
  // the next state).
  const scheduleNext = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      advanceRef.current();
    }, STEP_DURATION_MS);
  }, [clearTimer]);

  const advance = useCallback(() => {
    clearTimer();
    const prev = playbackRef.current;
    if (prev === null) return;
    const nextIndex = prev.index + 1;
    if (nextIndex < prev.steps.length) {
      writePlayback({ ...prev, index: nextIndex });
      scheduleNext();
      return;
    }
    const nextPlayback = dequeueNextPlayback();
    writePlayback(nextPlayback);
    if (nextPlayback !== null) scheduleNext();
  }, [clearTimer, dequeueNextPlayback, scheduleNext, writePlayback]);

  // Keep advanceRef pointing at the latest closure so the timer's
  // setTimeout body doesn't capture a stale binding.
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const pushTrace = useCallback(
    (trace: ResolveTrace) => {
      if (trace.outcome === 'noop') return;
      if (lastPushedRef.current === trace) return;
      lastPushedRef.current = trace;
      // Kick the queue immediately when idle. If the trace produces
      // zero steps (defensive — `noop` is filtered above) we fall
      // through to the enqueue branch so the queue's drain logic can
      // skip past it on the next advance.
      if (playbackRef.current === null && timeoutRef.current === null) {
        const pb = beginPlayback(trace);
        if (pb !== null) {
          writePlayback(pb);
          scheduleNext();
          return;
        }
      }
      // Defensive cap — drop the oldest entry rather than block.
      if (queueRef.current.length >= MAX_QUEUE_LENGTH) {
        queueRef.current.shift();
      }
      queueRef.current.push(trace);
    },
    [beginPlayback, scheduleNext, writePlayback],
  );

  // Cleanup: cancel any pending timeout when the provider unmounts.
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const value = useMemo<ResolveAnimationContextValue>(() => {
    if (playback === null) {
      return {
        current: null,
        currentStep: null,
        currentStepIndex: -1,
        totalSteps: 0,
        advance,
        pushTrace,
      };
    }
    return {
      current: playback.trace,
      currentStep: playback.steps[playback.index] ?? null,
      currentStepIndex: playback.index,
      totalSteps: playback.steps.length,
      advance,
      pushTrace,
    };
  }, [playback, advance, pushTrace]);

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
