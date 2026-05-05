// Defense redesign 3.3 — resolve animation context module (non-component).
//
// Split from `resolveAnimationContext.tsx` so that file only exports
// React components — the `react-refresh/only-export-components` rule
// requires the context object and the derived hook to live elsewhere.
//
// The context buffers `ResolveTrace`s the resolver appends to
// `G.track.traces` (and updates onto `G.track.lastResolve`). The
// `<ResolveAnimationProvider>` (in the sibling .tsx file) owns the
// queue and feeds traces through one at a time so the path overlay can
// animate without dropping frames during a multi-attack volley.

import { createContext, useContext, useMemo } from 'react';
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
   *  duplicates by reference. The `<ResolveTraceWatcher>` adapter
   *  calls this from a `useEffect` watching `G.track.lastResolve`. */
  pushTrace: (trace: ResolveTrace) => void;
}

export const ResolveAnimationContext =
  createContext<ResolveAnimationContextValue>({
    current: null,
    pushTrace: () => undefined,
  });

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
