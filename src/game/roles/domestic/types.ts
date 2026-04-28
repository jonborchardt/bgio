// 06.1 — Domestic role state types.
//
// These shapes back the Domestic role's hand and in-play building grid. The
// hand is the player's pile of buildings they can buy and place onto the
// grid; the grid is the placed-buildings map keyed by `'x,y'` cell strings.
//
// PLAN DEVIATIONS (intentional):
//
// 1. The plan API in `plans/06.1-hand-and-grid.md` declares
//      `grid: Map<string, DomesticBuilding>`
//    but Map values do not survive boardgame.io's Immer-frozen / JSON-
//    serialized state — bgio expects plain JSON-shaped state for replay,
//    network sync, and logging. We use `Record<string, DomesticBuilding>`
//    here (still keyed by `cellKey(x, y) === \`${x},${y}\``) so the rest of
//    the bgio pipeline keeps working. Helpers in `./grid.ts` operate on the
//    Record form.
//
// 2. The plan also says the hand starts as `BuildingDef[]`, while 05.3's
//    `scienceComplete` distributes `TechnologyDef` objects to a green-color
//    seat's `G.domestic.hand`. Those two slots are conceptually different
//    (a hand of placeable buildings vs. a hand of researched tech cards),
//    so we keep them as separate fields here:
//      - `hand: BuildingDef[]`        — the buy-and-place pile (06.1).
//      - `techHand?: TechnologyDef[]` — green-color tech distributed by
//                                       `scienceComplete` (05.3, was named
//                                       `hand` in that earlier slice).
//    `scienceComplete` was updated in lockstep to push to `techHand`.

import type { BuildingDef, TechnologyDef } from '../../../data/schema.ts';
import type { PlayerID } from '../../types.ts';

/** A single placed building on the Domestic grid. */
export interface DomesticBuilding {
  // Matches the originating `BuildingDef.name` so we can look the def up
  // again later (combat math, production, upgrade chains).
  defID: string;
  // Tracks how many times this building has been upgraded. 0 = baseline.
  upgrades: number;
  // The worker token currently on this building, if any. The Chief stamps
  // this in `chiefPlaceWorker` and clears it on round-end migration. The
  // `ownerSeat` is the seat that placed the worker (always the chief seat
  // today, but kept explicit so multi-chief variants stay representable).
  worker: { ownerSeat: PlayerID } | null;
}

/** Aggregated Domestic role state. Lives at `G.domestic`. */
export interface DomesticState {
  // Pile of building cards the Domestic seat may buy & place. Pre-shuffled
  // at setup; 06.2 will own the buy/upgrade move.
  hand: BuildingDef[];
  // Optional tech-card hand populated by 05.3's `scienceComplete` whenever
  // a green-color science card resolves. Distinct from `hand` (which is
  // BuildingDef[]); see the file-level note for the rename rationale.
  techHand?: TechnologyDef[];
  // Placed-buildings map, keyed by `cellKey(x, y) === \`${x},${y}\``.
  grid: Record<string, DomesticBuilding>;
}
