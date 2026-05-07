// Step decomposition for paced playback of a `ResolveTrace`.
//
// The engine still resolves a threat atomically inside `chiefFlipTrack`
// (good for networked play — every client sees the same final state),
// but the UI wants to walk the table through what happened in slow,
// click-or-timer-paced phases:
//
//   1. enter        — the threat advances along the path
//   2. fire (×n)    — each unit that fired in placement order
//   3. impact (×m)  — each impact tile in path order
//   4. centerBurn   — the vault losing tokens (only when reachedCenter)
//
// `decomposeTrace(trace)` produces a flat `ResolveStep[]` per trace with
// each step carrying the full set of cells / unit-ids / impact-keys to
// highlight at that moment (cumulative — earlier highlights persist into
// later steps so the table reads "what's been resolved so far"). The
// shape is intentionally pure data so future tweaks (e.g. richer
// per-step descriptions sourced from a side-channel resolver log)
// don't need to touch the playback context.
//
// Pure module — no React, no bgio. Safe to import from headless tests.

import type { ResolveTrace } from '../../game/track.ts';
import type { ResourceBag } from '../../game/resources/types.ts';

export type ResolveStepKind = 'enter' | 'fire' | 'impact' | 'centerBurn';

export interface ResolveStep {
  /** Phase of the resolve sequence this step represents. */
  kind: ResolveStepKind;
  /** Short, human-readable narration the playback HUD shows. */
  description: string;
  /** Path tiles to render under the trace overlay at this step. We
   *  always carry the full walked path so the overlay arrow doesn't
   *  appear and disappear between phases — the cumulative tints
   *  (impactKeys, firingUnitIDs) are what evolves step-to-step. */
  pathTiles: ReadonlyArray<{ x: number; y: number }>;
  /** Cell-keys highlighted as "the threat passed through here." Mirrors
   *  `pathTiles` but pre-formatted for the cell-tint consumer. */
  pathKeys: ReadonlySet<string>;
  /** Cell-keys highlighted as "this tile was hit" up to and including
   *  this step. Empty until the first impact step. */
  impactKeys: ReadonlySet<string>;
  /** Unit ids that have fired up to and including this step. Empty
   *  until the first fire step. */
  firingUnitIDs: ReadonlySet<string>;
  /** Only set on the `centerBurn` step. Total tokens burned. */
  centerBurned?: number;
  /** Only set on the `centerBurn` step. Per-resource breakdown. */
  centerBurnDetail?: Partial<ResourceBag>;
}

const pathKeySetOf = (
  tiles: ReadonlyArray<{ x: number; y: number }>,
): Set<string> => {
  const out = new Set<string>();
  for (const t of tiles) out.add(`${t.x},${t.y}`);
  return out;
};

/**
 * Decompose a `ResolveTrace` into the ordered playback steps the HUD +
 * overlay walk through. Returns an empty array for `noop` traces and
 * for traces with no path (the engine emits these for boons / modifiers
 * that were filtered upstream — defensive double-check).
 *
 * The decomposition is cumulative: each step's `firingUnitIDs` and
 * `impactKeys` include every prior step's, so a single render can read
 * the "current step" and paint the world as of that moment.
 */
export const decomposeTrace = (trace: ResolveTrace): ResolveStep[] => {
  if (trace.outcome === 'noop') return [];
  if (trace.pathTiles.length === 0) return [];

  const steps: ResolveStep[] = [];
  const pathTiles = trace.pathTiles;
  const pathKeys = pathKeySetOf(pathTiles);

  steps.push({
    kind: 'enter',
    description: 'Threat advances toward the vault.',
    pathTiles,
    pathKeys,
    impactKeys: new Set(),
    firingUnitIDs: new Set(),
  });

  const firedSoFar = new Set<string>();
  for (const id of trace.firingUnitIDs) {
    firedSoFar.add(id);
    steps.push({
      kind: 'fire',
      description: 'Defender fires.',
      pathTiles,
      pathKeys,
      impactKeys: new Set(),
      firingUnitIDs: new Set(firedSoFar),
    });
  }

  const impactsSoFar = new Set<string>();
  for (const cellKey of trace.impactTiles) {
    impactsSoFar.add(cellKey);
    steps.push({
      kind: 'impact',
      description: 'Threat damages a tile.',
      pathTiles,
      pathKeys,
      impactKeys: new Set(impactsSoFar),
      firingUnitIDs: new Set(firedSoFar),
    });
  }

  if (trace.centerBurned !== undefined && trace.centerBurned > 0) {
    const step: ResolveStep = {
      kind: 'centerBurn',
      description: 'Threat reaches the vault.',
      pathTiles,
      pathKeys,
      impactKeys: new Set(impactsSoFar),
      firingUnitIDs: new Set(firedSoFar),
      centerBurned: trace.centerBurned,
    };
    if (trace.centerBurnDetail !== undefined) {
      step.centerBurnDetail = trace.centerBurnDetail;
    }
    steps.push(step);
  }

  return steps;
};
