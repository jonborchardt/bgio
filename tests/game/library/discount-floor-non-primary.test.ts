// SL fix-5 gap #5 — discount-floor edge case for non-primary resources.
//
// The Splendor floor-1 rule applies *per resource that appears in the
// base cost*. A discount on a resource not in the base bag should NOT
// introduce that resource into the effective cost, and should NOT zero
// out unrelated lines.
//
// Concretely: a tableau of 5 red-T2 cards grants -5 steel. Pricing a
// green-T3 (10 wood + 3 production + 2 stone) against that tableau
// must leave wood / production / stone untouched and not drop steel
// below 0 (or above 0 — steel isn't in the base bag, so the effective
// cost's steel must stay 0).
//
// Conversely, when the same tableau prices a card whose cost DOES
// list steel (blue-T3 = 10 science + 3 wood + 2 steel), the steel
// discount must apply (floored at 1).

import { describe, expect, it } from 'vitest';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../src/data/schema.ts';
import {
  effectiveResearchCost,
  T2_PRIMARY_AMOUNT,
  T2_SECONDARY_AMOUNT,
  T3_PRIMARY_AMOUNT,
  T3_SECONDARY_AMOUNT,
  T3_TERTIARY_AMOUNT,
} from '../../../src/game/library/costs.ts';

const fakeCard = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  id = `${scienceColor}-${tier}`,
): LibraryCard =>
  ({
    kind: 'building',
    tier,
    scienceColor,
    def: {
      name: id,
      cost: 0,
      benefit: '',
      note: '',
      maxHp: 1,
    },
  }) as LibraryCard;

describe('SL fix-5 gap #5 — discount on a resource not in the base cost', () => {
  it('5 red T2 → -5 steel; pricing green T3 keeps cost at 10 wood + 3 production + 2 stone', () => {
    // 5 red-T2 cards each grant -1 steel. Steel is the red T2 secondary.
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 5; i++) {
      tableau.push(fakeCard('red', 2, `red-t2-${i}`));
    }

    const greenT3 = fakeCard('green', 3, 'green-t3-target');
    const eff = effectiveResearchCost(greenT3, tableau);

    // Green T3 base cost is 10 wood + 3 production + 2 stone. The
    // unrelated steel discount must not bleed into any of these.
    expect(eff.wood).toBe(T3_PRIMARY_AMOUNT); // 10
    expect(eff.production).toBe(T3_SECONDARY_AMOUNT); // 3
    expect(eff.stone).toBe(T3_TERTIARY_AMOUNT); // 2

    // And steel must NOT appear in the effective bag — discounts on
    // resources outside the base cost are no-ops.
    expect(eff.steel).toBe(0);

    // Sanity: every other resource is also 0 (no implicit creation).
    expect(eff.gold).toBe(0);
    expect(eff.science).toBe(0);
    expect(eff.food).toBe(0);
  });

  it('the same -5 steel tableau IS consumed when pricing a steel-costing card (blue T3)', () => {
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 5; i++) {
      tableau.push(fakeCard('red', 2, `red-t2-${i}`));
    }

    // Blue T3 = 10 science + 3 wood + 2 steel; steel is the tertiary.
    const blueT3 = fakeCard('blue', 3, 'blue-t3-target');
    const eff = effectiveResearchCost(blueT3, tableau);

    // Steel discount IS consumed here — base 2 steel - 5 discount,
    // floored at 1.
    expect(eff.steel).toBe(1);
    // The other base-cost lines stay at base (no relevant discounts).
    expect(eff.science).toBe(T3_PRIMARY_AMOUNT); // 10
    expect(eff.wood).toBe(T3_SECONDARY_AMOUNT); // 3
  });

  it('a single red T2 in the tableau leaves a green T3 totally untouched', () => {
    // Tighter regression pin: even 1 red-T2 (-1 steel) must not reduce
    // any of green-T3's costs (none of which are steel).
    const tableau = [fakeCard('red', 2)];
    const greenT3 = fakeCard('green', 3);
    const eff = effectiveResearchCost(greenT3, tableau);

    expect(eff.wood).toBe(T3_PRIMARY_AMOUNT);
    expect(eff.production).toBe(T3_SECONDARY_AMOUNT);
    expect(eff.stone).toBe(T3_TERTIARY_AMOUNT);
    expect(eff.steel).toBe(0);
  });

  it('mixed: 5 red T2 + 1 green T1 prices green T2 (7 wood + 2 production) with only the wood discount', () => {
    // Steel discount stays a no-op because steel isn't in green-T2's
    // cost; the green T1 (-1 wood) IS consumed.
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 5; i++) tableau.push(fakeCard('red', 2, `red-t2-${i}`));
    tableau.push(fakeCard('green', 1, 'green-t1-discount'));

    const greenT2 = fakeCard('green', 2);
    const eff = effectiveResearchCost(greenT2, tableau);

    expect(eff.wood).toBe(T2_PRIMARY_AMOUNT - 1); // 7 - 1 = 6
    expect(eff.production).toBe(T2_SECONDARY_AMOUNT); // 2 (no discount)
    expect(eff.steel).toBe(0); // unrelated discount is a no-op
  });
});
