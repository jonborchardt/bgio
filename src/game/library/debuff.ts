// Science Library SL 4 — boss debuff thresholds.
//
// The Library's per-color discount-tableau counts feed a "research debuff"
// applied at boss-resolution time. Reaching 5 / 10 / 15 cards of one color
// in any tableau bumps that color's debuff level by 1 / 2 / 3 (master plan
// §"Win-assist thresholds").
//
// V1 default for the actual debuff effect (this is master-plan open
// question #1 — the proper "what does each color do to the boss" mapping
// depends on boss content shape that hasn't been authored yet):
//
//   - Each level of any color subtracts 1 from every boss attack's
//     strength when that attack lands as a synthetic ThreatCard. The
//     reduction is applied as a sum across all four colors (so a tableau
//     with 5 gold + 10 blue subtracts 1 + 2 = 3 from each attack's
//     strength). Floor at 0 — a debuffed attack of base strength 2 with
//     a -3 debuff lands at strength 0, not negative.
//
// TODO(master plan #1): refine the per-color → attack-flavor mapping when
// boss content gets per-flavor `attackPattern` entries. Until the content
// carries a `flavor` field on ThreatPattern, applying the aggregate sum
// keeps the threshold rule readable without inventing a flavor taxonomy
// boss authors haven't agreed to yet.
//
// Pure functions only — this module mutates nothing. The boss resolver
// (../track/boss.ts) calls `aggregateLibraryDebuffs(G)` once per boss
// flip and folds the result into each attack's `strength` before
// dispatching the synthetic threat through `resolveThreat`.

import type { LibraryCard } from './types.ts';
import type { LibraryColor } from '../../data/schema.ts';
import type { SettlementState } from '../types.ts';

export type DebuffLevel = 0 | 1 | 2 | 3;

export interface LibraryDebuffs {
  gold: DebuffLevel;
  blue: DebuffLevel;
  green: DebuffLevel;
  red: DebuffLevel;
}

const TIER_1_THRESHOLD = 5;
const TIER_2_THRESHOLD = 10;
const TIER_3_THRESHOLD = 15;

export const libraryDebuffLevel = (
  tableau: ReadonlyArray<LibraryCard>,
  color: LibraryColor,
): DebuffLevel => {
  let n = 0;
  for (const c of tableau) {
    if (c.scienceColor === color) n += 1;
  }
  if (n >= TIER_3_THRESHOLD) return 3;
  if (n >= TIER_2_THRESHOLD) return 2;
  if (n >= TIER_1_THRESHOLD) return 1;
  return 0;
};

const ZERO_DEBUFFS: LibraryDebuffs = Object.freeze({
  gold: 0,
  blue: 0,
  green: 0,
  red: 0,
});

// Walks every seat's discount tableau, concatenates them, and reads the
// debuff level per color off the combined pile. Per the master plan, only
// the science seat actually accumulates entries today — but the shape is
// per-seat so a future "shared library" or multi-researcher variant can
// be added without rewriting the boss reader.
export const aggregateLibraryDebuffs = (
  G: SettlementState,
): LibraryDebuffs => {
  const lib = G.library;
  if (lib === undefined) return { ...ZERO_DEBUFFS };
  const all: LibraryCard[] = [];
  for (const seat of Object.keys(lib.discountTableaus)) {
    const t = lib.discountTableaus[seat];
    if (t !== undefined) all.push(...t);
  }
  return {
    gold: libraryDebuffLevel(all, 'gold'),
    blue: libraryDebuffLevel(all, 'blue'),
    green: libraryDebuffLevel(all, 'green'),
    red: libraryDebuffLevel(all, 'red'),
  };
};

// Sum of all four color debuff levels. The V1 default applies this as a
// flat strength reduction on each boss attack (see file comment).
export const totalDebuffReduction = (debuffs: LibraryDebuffs): number =>
  debuffs.gold + debuffs.blue + debuffs.green + debuffs.red;
