// Layout registry. Each board's five candidates are exported from a
// sibling file under this folder; this index file is the only place
// that knows the full set. To delete a candidate: remove its function
// + entry in the per-board file. To delete an entire board: remove
// the file + the entry below.

import type { BoardSection } from '../types.ts';
import { CENTRAL_LAYOUTS } from './central.tsx';
import { CHIEF_LAYOUTS } from './chief.tsx';
import { SCIENCE_LAYOUTS } from './science.tsx';
import { DOMESTIC_LAYOUTS } from './domestic.tsx';
import { DEFENSE_LAYOUTS } from './defense.tsx';

export const BOARD_SECTIONS: ReadonlyArray<BoardSection> = [
  {
    kind: 'central',
    label: 'Central board',
    intro:
      'The table-shared frame: track strip on top, the village (3×3 building grid) below, and the boss-threshold trackers + lost-ideas pile somewhere in the layout. Visible to every seat.',
    layouts: CENTRAL_LAYOUTS,
  },
  {
    kind: 'chief',
    label: 'Chief panel',
    intro:
      'Chief\'s per-turn surface: distribute resources to the three non-chief seats, fire the once-per-round Tax, optionally play a gold tech card, and drive the chief→others phase boundary.',
    layouts: CHIEF_LAYOUTS,
  },
  {
    kind: 'science',
    label: 'Science panel',
    intro:
      'Science\'s per-turn surface: Buy / Burn from the 6-slot Library, run Drill / Teach moves on a Defense unit, optionally play a blue tech, and watch the per-seat discount tableau snowball.',
    layouts: SCIENCE_LAYOUTS,
  },
  {
    kind: 'domestic',
    label: 'Domestic panel',
    intro:
      'Domestic\'s per-turn surface: pick a building from the hand to arm placement on the village (the grid lives at board level, not in the panel), and play green techs to unlock more buildings.',
    layouts: DOMESTIC_LAYOUTS,
  },
  {
    kind: 'defense',
    label: 'Defense panel',
    intro:
      'Defense\'s per-turn surface: recruit a unit and place it on a village tile, play a red tech, and watch the in-play army deal with the threat path. The grid lives at board level.',
    layouts: DEFENSE_LAYOUTS,
  },
];
