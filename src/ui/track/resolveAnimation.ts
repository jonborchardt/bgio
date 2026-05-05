// Resolve-animation context module (non-component).
//
// Split from `resolveAnimationContext.tsx` so that file only exports
// React components — the `react-refresh/only-export-components` rule
// requires the context object and the derived hook to live elsewhere.
//
// The provider buffers `ResolveTrace`s the resolver appends to
// `G.track.traces` (and updates onto `G.track.lastResolve`). Each trace
// is decomposed via `decomposeTrace()` into ordered `ResolveStep`s
// (enter → per-unit fire → per-tile impact → optional centerBurn) and
// the HUD walks the table through them one at a time. Steps advance
// either via the auto-advance timer or via the player clicking
// "Continue" on the step banner — both routes call the same `advance()`.
//
// Pacing rationale: the previous "fire and forget" animation ran the
// whole resolution in 350 ms which made it impossible to read what was
// happening. Stepping through with a per-step pause + manual override
// lets the table parse the consequences of each flip; the constants
// below are tuned for hot-seat reading speed and can be retuned without
// touching component code.

import { createContext, useContext, useMemo } from 'react';
import type { ResolveTrace } from '../../game/track.ts';
import type { ResolveStep } from './resolveSteps.ts';

/** Auto-advance interval per playback step. The HUD's "Continue" button
 *  cancels the timer and advances immediately, so this is the upper
 *  bound on how long the table waits before the next phase plays — in
 *  practice the table will click through the steps. The value is
 *  intentionally long so an idle / inattentive table doesn't blow
 *  through a multi-step combat without seeing each phase. */
export const STEP_DURATION_MS = 36000;

/** Backwards-compat alias retained so existing callers / tests that
 *  import the previous one-shot duration still type-check. The value is
 *  the per-step duration — the previous semantics ("how long until the
 *  current animation clears") still hold, just one step at a time. */
export const ANIMATION_DURATION_MS = STEP_DURATION_MS;

/** Hard cap on the internal trace queue. Real games will see ≤ 8 boss
 *  attacks per flip; a queue beyond ~16 means something upstream went
 *  wrong, and we drop the oldest entries rather than block the UI. */
export const MAX_QUEUE_LENGTH = 16;

export interface ResolveAnimationContextValue {
  /** The trace currently animating, or `null` when idle. */
  current: ResolveTrace | null;
  /** The active step within the currently-playing trace, or `null` when
   *  idle / between traces. The HUD reads `currentStep.description` for
   *  the banner copy and `currentStep.pathKeys` / `impactKeys` /
   *  `firingUnitIDs` to drive cell tints. */
  currentStep: ResolveStep | null;
  /** Zero-based step index within the current trace. `-1` when idle. */
  currentStepIndex: number;
  /** Total step count for the current trace. `0` when idle. */
  totalSteps: number;
  /** Advance to the next step (or to the next queued trace when the
   *  current trace's last step is active). No-op when idle. The HUD's
   *  "Continue" button calls this; the auto-advance timer does too. */
  advance: () => void;
  /** Push a trace onto the playback queue. Skips `noop` traces and
   *  duplicates by reference. The `<ResolveTraceWatcher>` adapter
   *  calls this from a `useEffect` watching `G.track.lastResolve`. */
  pushTrace: (trace: ResolveTrace) => void;
}

export const ResolveAnimationContext =
  createContext<ResolveAnimationContextValue>({
    current: null,
    currentStep: null,
    currentStepIndex: -1,
    totalSteps: 0,
    advance: () => undefined,
    pushTrace: () => undefined,
  });

/**
 * Convenience hook that derives a `{ pathKeys, impactKeys, firingUnitIDs }`
 * shape from the active step of the currently-animating trace. Returns
 * `undefined` when idle — the BuildingGrid forwards that straight to
 * its `pathHighlight` prop. Memoized on the active step's identity so
 * the consumer doesn't recompute the Sets every render while the same
 * step is showing.
 */
export const useActivePathHighlight = (): {
  pathKeys: ReadonlySet<string>;
  impactKeys: ReadonlySet<string>;
  firingUnitIDs: ReadonlySet<string>;
} | undefined => {
  const { currentStep } = useContext(ResolveAnimationContext);
  return useMemo(() => {
    if (currentStep === null) return undefined;
    return {
      pathKeys: currentStep.pathKeys,
      impactKeys: currentStep.impactKeys,
      firingUnitIDs: currentStep.firingUnitIDs,
    };
  }, [currentStep]);
};
