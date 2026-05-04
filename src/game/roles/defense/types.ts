// Defense role types (1.4 — defense redesign).
//
// The retired role's count-collapsed `UnitInstance` was tied to the
// retired battle resolver. Phase 2 will need per-instance state (HP,
// drill marker, taught skills, building-tile placement). Per the
// defense-redesign-spec D11/D13 we pre-rename to the Phase 2 shape now,
// since 1.4 is the "we're touching defense state anyway" sub-phase. Phase
// 2 will *read* these fields; it doesn't reshape them.
//
// Pure types. No runtime, no boardgame.io imports.

import type { TechnologyDef, UnitDef } from '../../../data/schema.ts';

/**
 * One placed unit. `id` is a synthetic stable handle assigned at place
 * time so stack order and per-instance state (drill, taught skills) can
 * be referenced unambiguously across rounds. `cellKey` matches a placed
 * domestic building's cell coordinate (e.g. `"1,0"`).
 *
 * `placementOrder` is monotonic across the whole match — Phase 2 uses it
 * to resolve "first in, first killed" for stack consumption (D13). The
 * field is filled by whichever move places the unit (Phase 2.4).
 *
 * Optional fields land in Phase 2:
 *   - `drillToken` — set by `scienceDrill` (Phase 2.7), consumed at
 *     fire time.
 *   - `taughtSkills` — set by `scienceTeach` (Phase 2.7), durable
 *     across rounds.
 */
export interface UnitInstance {
  id: string;
  defID: string;
  cellKey: string;
  hp: number;
  placementOrder: number;
  drillToken?: boolean;
  taughtSkills?: string[];
}

/**
 * Defense role state. Shrinks dramatically vs. the retired ForeignState:
 * no battle / trade decks, no inFlight slot, no upkeep / pending tribute.
 *
 * - `hand`     : unit cards available to buy (Phase 2 will repopulate
 *                this; for 1.4 it stays empty).
 * - `techHand` : red-color tech cards distributed by `scienceComplete`
 *                (existing 05.3 plumbing).
 * - `inPlay`   : units currently on the village grid. Empty in 1.4 — no
 *                moves yet place anything.
 * - `_placementSeq` : Defense redesign 2.5 — monotonic next-to-issue
 *                `placementOrder` for new unit instances. Lazy-init in
 *                `nextPlacementOrder`; survives across rounds so first-
 *                in-first-killed stack ordering is unambiguous (D13).
 *                Optional so older fixtures (1.4) stay source-compatible.
 * - `_peeked`  : Defense redesign 2.5 — set of track-card ids the
 *                defense seat has revealed via the red `peek` track-
 *                modifier tech effect. Pure UI metadata (the underlying
 *                `G.track.upcoming` is already public, per playerView);
 *                the marker exists so the defense panel can call out
 *                "you peeked these" vs. "next-up telegraph." Optional.
 */
export interface DefenseState {
  hand: UnitDef[];
  techHand?: TechnologyDef[];
  inPlay: UnitInstance[];
  _placementSeq?: number;
  _peeked?: string[];
}
