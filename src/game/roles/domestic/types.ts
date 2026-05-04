// Domestic role state types.
//
// These shapes back the Domestic role's hand and in-play building grid. The
// hand is the player's pile of buildings they can buy and place onto the
// grid; the grid is the placed-buildings map keyed by `'x,y'` cell strings.
//
// Two intentional shape choices worth documenting:
//
// 1. `grid` is `Record<string, DomesticBuilding>` rather than a `Map`.
//    Map values do not survive boardgame.io's Immer-frozen / JSON-
//    serialized state — bgio expects plain JSON-shaped state for replay,
//    network sync, and logging. The Record form is keyed by
//    `cellKey(x, y) === \`${x},${y}\``; helpers in `./grid.ts` operate on
//    that form.
//
// 2. The hand splits into two named slots — `hand: BuildingDef[]` for the
//    buy-and-place pile, and `techHand?: TechnologyDef[]` for green-color
//    tech cards distributed by `scienceComplete`. They started life as a
//    single `hand` slot before tech-card distribution landed; keeping them
//    separate now keeps each move's domain narrow.

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
  // Defense redesign D2 — the seeded `(0, 0)` village-vault tile is flagged
  // here. Set on exactly one cell, and only on that cell — every other
  // grid entry omits the field. Code paths that care (production / repair
  // / upgrade / worker placement / future combat resolver) check this
  // flag rather than the `defID` so the synthetic tile stays out of the
  // BUILDINGS data path. The center tile is **not** repairable,
  // producible, upgradeable, or worker-targetable.
  isCenter?: true;
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
  // Idempotency latch for `domesticProduce` (06.4): once produce runs in a
  // round, this is set to `true` so subsequent calls return INVALID_MOVE.
  // Cleared by the `domestic:reset-produced` round-end hook registered in
  // `produce.ts`. Optional so older fixtures stay source-compatible.
  producedThisRound?: boolean;
}
