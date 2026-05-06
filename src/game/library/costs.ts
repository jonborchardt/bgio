// Science Library SL 1.2 — pure cost / discount functions.
//
// No bgio imports, no mutation, no state. Each function is a pure
// function of its inputs. Use named constants for the placeholder
// numbers so paper-play tuning is a one-line edit.

import type { LibraryCard } from './types.ts';
import type { LibraryColor, LibraryTier } from '../../data/schema.ts';
import type { Resource, ResourceBag } from '../resources/types.ts';
import { EMPTY_BAG, RESOURCES } from '../resources/types.ts';

// Placeholder cost amounts (master plan §"Per-tier cost rule"). Tunable
// via paper play.
export const T1_PRIMARY_AMOUNT = 4;
export const T2_PRIMARY_AMOUNT = 7;
export const T2_SECONDARY_AMOUNT = 2;
export const T3_PRIMARY_AMOUNT = 10;
export const T3_SECONDARY_AMOUNT = 3;
export const T3_TERTIARY_AMOUNT = 2;

// Color → resource ladder (master plan §"Color → resource ladder").
// Index 0 = primary (T1+), 1 = secondary (T2+), 2 = tertiary (T3 only).
type Ladder = readonly [Resource, Resource, Resource];

export const RESEARCH_COST_TABLE: Readonly<Record<LibraryColor, Ladder>> =
  Object.freeze({
    gold: ['gold', 'food', 'science'] as const,
    blue: ['science', 'wood', 'steel'] as const,
    green: ['wood', 'production', 'stone'] as const,
    red: ['stone', 'steel', 'gold'] as const,
  });

const baseCostFor = (color: LibraryColor, tier: LibraryTier): ResourceBag => {
  const ladder = RESEARCH_COST_TABLE[color];
  const out: ResourceBag = { ...EMPTY_BAG };
  if (tier === 1) {
    out[ladder[0]] += T1_PRIMARY_AMOUNT;
    return out;
  }
  if (tier === 2) {
    out[ladder[0]] += T2_PRIMARY_AMOUNT;
    out[ladder[1]] += T2_SECONDARY_AMOUNT;
    return out;
  }
  out[ladder[0]] += T3_PRIMARY_AMOUNT;
  out[ladder[1]] += T3_SECONDARY_AMOUNT;
  out[ladder[2]] += T3_TERTIARY_AMOUNT;
  return out;
};

// Returns the full base resource bag the science seat must pay for the
// card (before discounts).
export const researchCost = (card: LibraryCard): ResourceBag =>
  baseCostFor(card.scienceColor, card.tier);

// Returns the resource whose discount this card grants when bought —
// the highest-tier resource it adds to the cost bag.
//   T1 → primary, T2 → secondary, T3 → tertiary.
export const discountResource = (card: LibraryCard): Resource => {
  const ladder = RESEARCH_COST_TABLE[card.scienceColor];
  if (card.tier === 1) return ladder[0];
  if (card.tier === 2) return ladder[1];
  return ladder[2];
};

// Applies a discount tableau (the list of cards already bought, each
// granting -1 of its `discountResource`) to a card's base research
// cost. Floored at 1 per resource that appears in the base bag
// (Splendor rule). A discount on a resource not in the base is a
// no-op.
export const effectiveResearchCost = (
  card: LibraryCard,
  tableau: ReadonlyArray<LibraryCard>,
): ResourceBag => {
  const base = researchCost(card);
  // Tally discount counts per resource.
  const discounts: Partial<Record<Resource, number>> = {};
  for (const c of tableau) {
    const r = discountResource(c);
    discounts[r] = (discounts[r] ?? 0) + 1;
  }
  const out: ResourceBag = { ...EMPTY_BAG };
  for (const r of RESOURCES) {
    const baseAmount = base[r];
    if (baseAmount <= 0) {
      // Resource not in base cost — discounts are a no-op (no negative
      // amounts, no implicit resource added).
      out[r] = 0;
      continue;
    }
    const after = baseAmount - (discounts[r] ?? 0);
    out[r] = after < 1 ? 1 : after;
  }
  return out;
};
