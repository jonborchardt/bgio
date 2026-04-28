// Science role — initial 3×3 grid + per-cell stack of tech cards.
//
// Per game-design.md §Science Option 1, the science board is a 3-tier × 3-color
// grid. We pick the three columns out of the four science-card colors at game
// start (random subset; the fourth color sits out for the game), then for each
// (tier, color) cell we shuffle the matching subset of SCIENCE_CARDS and pick
// one. Under each science card we slot 4 random TECHNOLOGIES drawn from the
// branch that maps to that card's color.
//
// Color → branch mapping (decision noted in 05.1):
//   red    → Fighting     (combat / warfare)
//   gold   → Exploration  (loot, scavenging, gold-tinted treasure events)
//   green  → Civic        (settlement / community)
//   blue   → Education    (study / theory)
//
// The mapping is hard-coded here rather than parametrized via JSON because
// it's a design choice, not content data. If the assignment ever needs to
// change, this is the single source of truth.

import type { TechnologyDef } from '../../../data/index.ts';
import { TECHNOLOGIES } from '../../../data/index.ts';
import type { ScienceCardDef } from '../../../data/scienceCards.ts';
import { SCIENCE_CARDS } from '../../../data/scienceCards.ts';
import type { ResourceBag } from '../../resources/types.ts';
import type { RandomAPI } from '../../random.ts';
import { registerRoundEndHook } from '../../hooks.ts';

export type ScienceColor = 'red' | 'gold' | 'green' | 'blue';
export type ScienceTier = 'beginner' | 'intermediate' | 'advanced';

export interface ScienceState {
  // grid[col][row] — column = color, row = tier (0 = beginner / lowest level).
  grid: ScienceCardDef[][];
  // 4 face-down tech cards per science card, keyed by science card id.
  underCards: Record<string, TechnologyDef[]>;
  // Per-card running tally of resources contributed toward completing it.
  paid: Record<string, ResourceBag>;
  // Ids of completed science cards (in completion order).
  completed: string[];
  // How many science cards have been completed in the current round; reset
  // by the `science:reset-completions` hook at endOfRound.onBegin.
  perRoundCompletions: number;
  // The Science role's tech-card hand — populated by `scienceComplete` (05.3)
  // when a blue-color science card resolves. Starts empty.
  hand: TechnologyDef[];
}

const COLOR_TO_BRANCH: Record<ScienceColor, string> = {
  red: 'Fighting',
  gold: 'Exploration',
  green: 'Civic',
  blue: 'Education',
};

const TIERS_IN_ROW_ORDER: readonly ScienceTier[] = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

const ALL_COLORS: readonly ScienceColor[] = [
  'red',
  'gold',
  'green',
  'blue',
] as const;

// Pick the lowest-level card from `pool` (it's already in random order). When
// multiple cards share the same level we keep the one that surfaced first in
// the shuffle, which keeps the row-0=lowest invariant deterministic per seed.
const pickLowestLevel = (pool: ScienceCardDef[]): ScienceCardDef => {
  let best: ScienceCardDef | undefined;
  for (const c of pool) {
    if (best === undefined || c.level < best.level) best = c;
  }
  if (best === undefined) {
    throw new Error('pickLowestLevel: empty pool');
  }
  return best;
};

export const setupScience = (random: RandomAPI): ScienceState => {
  // Shuffle each tier's pool independently — the plan calls for "shuffle
  // each tier separately, take 9 from each tier". Even though the 3×3 grid
  // only uses 9 cells total (3 colors × 3 tiers = 9), we shuffle per tier
  // first so the per-cell selection still draws from a randomized order.
  const byTier: Record<ScienceTier, ScienceCardDef[]> = {
    beginner: random.shuffle(
      SCIENCE_CARDS.filter((c) => c.tier === 'beginner'),
    ),
    intermediate: random.shuffle(
      SCIENCE_CARDS.filter((c) => c.tier === 'intermediate'),
    ),
    advanced: random.shuffle(
      SCIENCE_CARDS.filter((c) => c.tier === 'advanced'),
    ),
  };

  // Pick 3 columns out of the 4 science colors. The fourth color sits out.
  const shuffledColors = random.shuffle(ALL_COLORS);
  const selectedColors: ScienceColor[] = shuffledColors.slice(0, 3);

  const grid: ScienceCardDef[][] = [];
  const underCards: Record<string, TechnologyDef[]> = {};
  const paid: Record<string, ResourceBag> = {};

  for (const color of selectedColors) {
    const column: ScienceCardDef[] = [];
    for (const tier of TIERS_IN_ROW_ORDER) {
      // Filter the tier's shuffled pool to this color, then take the
      // lowest-level card. (Per 01.1 of the data file, beginner=level 0,
      // intermediate=level 1, advanced=level 2, but we don't hard-code the
      // mapping in case future content adds variant levels within a tier.)
      const pool = byTier[tier].filter((c) => c.color === color);
      if (pool.length === 0) {
        throw new Error(
          `setupScience: no ${tier} card for color ${color}`,
        );
      }
      const card = pickLowestLevel(pool);
      column.push(card);

      // Slot 4 random tech cards from the matching branch under this cell.
      const branch = COLOR_TO_BRANCH[color];
      const branchPool = TECHNOLOGIES.filter((t) => t.branch === branch);
      if (branchPool.length < 4) {
        throw new Error(
          `setupScience: branch ${branch} has only ${branchPool.length} tech cards (need 4)`,
        );
      }
      underCards[card.id] = random.shuffle(branchPool).slice(0, 4);

      // Initialize an empty per-card paid tally. We use `EMPTY_BAG` shape
      // with all-zero entries so move-time arithmetic via `add` lands on a
      // mutable, fresh object (not the frozen shared constant).
      paid[card.id] = {
        gold: 0,
        wood: 0,
        stone: 0,
        steel: 0,
        horse: 0,
        food: 0,
        production: 0,
        science: 0,
        happiness: 0,
        worker: 0,
      };
    }
    grid.push(column);
  }

  return {
    grid,
    underCards,
    paid,
    completed: [],
    perRoundCompletions: 0,
    hand: [],
  };
};

// Round-end hook: clear the per-round completion counter so the next round
// starts fresh. Registered at module load (idempotent — see 02.5 hooks
// registry contract). Tests that need a clean slate must call
// `__resetHooksForTest()` and then re-import this module.
registerRoundEndHook('science:reset-completions', (G) => {
  if (G.science !== undefined) {
    G.science.perRoundCompletions = 0;
  }
});
