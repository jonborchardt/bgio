// Defense redesign 2.5 — monotonic placement-order counter for unit
// instances.
//
// `placementOrder` on `UnitInstance` decides "first in, first killed"
// stack consumption (D13) and the deterministic fire-order within a
// first-strike tier. The counter has to be:
//   - monotonic across the whole match (so it survives rounds and
//     stack consumption that removes earlier-placed units),
//   - deterministic given a seeded run (no `Math.random` reach-around),
//   - a single source of truth (the plan's prose mentions two fields
//     `_instanceCounter` and `_defensePlacementSeq`; we fold them into
//     one to avoid divergence).
//
// We store the next-to-issue value on `G.defense._placementSeq` rather
// than scanning `inPlay` for the max + 1. That scan would silently
// reset to 0 if the stack is wiped between recruits and a future
// recruit got a duplicate `placementOrder`. The counter never goes
// down, even when units die.

import type { SettlementState } from '../../types.ts';

/**
 * Return the next `placementOrder` for a new unit. Mutates
 * `G.defense._placementSeq` in place. Lazy-initializes from the current
 * `inPlay` so older test fixtures (which seed units directly with
 * `placementOrder` values) don't collide with the next-issued value.
 *
 * Throws when `G.defense` is undefined — that's a logic bug at the call
 * site (the caller must have already validated `defense` exists).
 */
export const nextPlacementOrder = (G: SettlementState): number => {
  const defense = G.defense;
  if (defense === undefined) {
    throw new Error(
      'nextPlacementOrder: G.defense is undefined — gate the call site on defense existence first',
    );
  }
  if (defense._placementSeq === undefined) {
    // Seed from the current inPlay so any pre-seeded fixtures don't
    // mint a duplicate placementOrder.
    let max = -1;
    for (const u of defense.inPlay) {
      if (u.placementOrder > max) max = u.placementOrder;
    }
    defense._placementSeq = max + 1;
  }
  const issued = defense._placementSeq;
  defense._placementSeq = issued + 1;
  return issued;
};
