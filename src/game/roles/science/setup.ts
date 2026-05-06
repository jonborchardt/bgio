// Science role state — the Library replaces the old 3×4 grid; the
// surviving fields are the blue-tech `hand` and the per-round
// drill/teach latches (D27).

import type { TechnologyDef } from '../../../data/index.ts';

export type ScienceColor = 'red' | 'gold' | 'green' | 'blue';

export interface ScienceState {
  // The Science role's tech-card hand — populated by `scienceLibraryBuy`
  // when a blue-color Library card resolves.
  hand: TechnologyDef[];
  // D27 once-per-round latches for `scienceDrill` / `scienceTeach`. The
  // round-end resets are registered in those move modules.
  scienceDrillUsed?: boolean;
  scienceTaughtUsed?: boolean;
  // Per-round latch — Library burns are mandatory: the seat must burn
  // at least one card before ending its turn. `scienceLibraryBurn`
  // flips this on; the round-end hook in that module clears it.
  scienceBurnedThisRound?: boolean;
}

export const setupScience = (): ScienceState => ({
  hand: [],
});
