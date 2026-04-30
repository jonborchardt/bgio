// 07.2 — Foreign role unit-instance types.
//
// `UnitInstance` is the count-based representation of recruited units in
// `G.foreign.inPlay`. We don't store one entry per recruited unit — instead
// every duplicate of the same `UnitDef.name` collapses into a single entry
// with `count` incrementing. `foreignRecruit` / `foreignReleaseUnit` keep the
// invariant that no two entries share a `defID`.
//
// `BattleInFlight` is the per-flip slot for the active battle card and the
// units the Foreign player has committed to fight it. The full flip-flow
// resolution lands in 07.3 / 07.4 — for 07.2 we just seed it empty.
//
// Pure types. No runtime, no boardgame.io imports.

import type { BattleCardDef } from '../../../data/decks.ts';

/**
 * One row in `G.foreign.inPlay`. `defID` matches `UnitDef.name`. `count` is
 * always >= 1 — when a release brings `count` to 0 the entry is removed.
 */
export interface UnitInstance {
  defID: string;
  count: number;
}

/**
 * The currently-flipped battle card and the units committed against it.
 * `battle === null` means there is no battle in flight (the default at
 * setup, and the cleared state after a battle resolves).
 */
export interface BattleInFlight {
  battle: BattleCardDef | null;
  committed: UnitInstance[];
}
