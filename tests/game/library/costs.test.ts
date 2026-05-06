// SL 1.2 — pure cost / discount function tests.

import { describe, expect, it } from 'vitest';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../src/data/schema.ts';
import {
  researchCost,
  discountResource,
  effectiveResearchCost,
  RESEARCH_COST_TABLE,
  T1_PRIMARY_AMOUNT,
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

describe('SL 1.2 — researchCost', () => {
  const COLORS: LibraryColor[] = ['gold', 'blue', 'green', 'red'];

  it('T1 = `T1_PRIMARY_AMOUNT` of the primary resource', () => {
    for (const color of COLORS) {
      const ladder = RESEARCH_COST_TABLE[color];
      const bag = researchCost(fakeCard(color, 1));
      expect(bag[ladder[0]]).toBe(T1_PRIMARY_AMOUNT);
      expect(bag[ladder[1]]).toBe(0);
      expect(bag[ladder[2]]).toBe(0);
    }
  });

  it('T2 = primary + secondary', () => {
    for (const color of COLORS) {
      const ladder = RESEARCH_COST_TABLE[color];
      const bag = researchCost(fakeCard(color, 2));
      expect(bag[ladder[0]]).toBe(T2_PRIMARY_AMOUNT);
      expect(bag[ladder[1]]).toBe(T2_SECONDARY_AMOUNT);
      expect(bag[ladder[2]]).toBe(0);
    }
  });

  it('T3 = primary + secondary + tertiary', () => {
    for (const color of COLORS) {
      const ladder = RESEARCH_COST_TABLE[color];
      const bag = researchCost(fakeCard(color, 3));
      expect(bag[ladder[0]]).toBe(T3_PRIMARY_AMOUNT);
      expect(bag[ladder[1]]).toBe(T3_SECONDARY_AMOUNT);
      expect(bag[ladder[2]]).toBe(T3_TERTIARY_AMOUNT);
    }
  });
});

describe('SL 1.2 — discountResource', () => {
  it('T1 → primary, T2 → secondary, T3 → tertiary, for every color', () => {
    const COLORS: LibraryColor[] = ['gold', 'blue', 'green', 'red'];
    for (const color of COLORS) {
      const ladder = RESEARCH_COST_TABLE[color];
      expect(discountResource(fakeCard(color, 1))).toBe(ladder[0]);
      expect(discountResource(fakeCard(color, 2))).toBe(ladder[1]);
      expect(discountResource(fakeCard(color, 3))).toBe(ladder[2]);
    }
  });
});

describe('SL 1.2 — effectiveResearchCost', () => {
  it('with empty tableau, returns the base cost', () => {
    const card = fakeCard('green', 1);
    const eff = effectiveResearchCost(card, []);
    expect(eff.wood).toBe(T1_PRIMARY_AMOUNT);
  });

  it('floors at 1: 4 wood with -10 wood discount → 1 wood', () => {
    const card = fakeCard('green', 1);
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 10; i++) {
      tableau.push(fakeCard('green', 1, `dummy-${i}`));
    }
    const eff = effectiveResearchCost(card, tableau);
    expect(eff.wood).toBe(1);
    expect(eff.wood).toBeGreaterThan(0);
  });

  it('5 wood discounts on a 4-wood T1 cost still floors at 1, never -1', () => {
    const card = fakeCard('green', 1);
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 5; i++) {
      tableau.push(fakeCard('green', 1, `dummy-${i}`));
    }
    const eff = effectiveResearchCost(card, tableau);
    expect(eff.wood).toBe(1);
  });

  it('discount on a resource not in the base cost is a no-op', () => {
    // Card is green T1 (4 wood). Tableau is red T1 (granting -1 stone).
    // Stone is not in the base cost → no effect anywhere.
    const card = fakeCard('green', 1);
    const tableau = [fakeCard('red', 1)];
    const eff = effectiveResearchCost(card, tableau);
    expect(eff.wood).toBe(T1_PRIMARY_AMOUNT);
    expect(eff.stone).toBe(0);
  });

  it('partial stack: 2 wood discounts on a 4-wood T1 cost → 2 wood', () => {
    const card = fakeCard('green', 1);
    const tableau = [fakeCard('green', 1, 'a'), fakeCard('green', 1, 'b')];
    const eff = effectiveResearchCost(card, tableau);
    expect(eff.wood).toBe(2);
  });

  it('multi-resource T2 cost reduces independently per resource', () => {
    // green T2 = 7 wood + 2 production. -1 wood (one green T1) and
    // -1 production (one green T2 from elsewhere) reduces independently.
    const card = fakeCard('green', 2);
    const tableau = [fakeCard('green', 1), fakeCard('green', 2, 'other')];
    const eff = effectiveResearchCost(card, tableau);
    expect(eff.wood).toBe(T2_PRIMARY_AMOUNT - 1);
    expect(eff.production).toBe(T2_SECONDARY_AMOUNT - 1);
  });

  it('floor-1 only applies to resources actually in the base bag', () => {
    // green T1 = 4 wood. effective bag should have wood >= 1, but every
    // other resource stays 0 (no implicit resource introduced).
    const card = fakeCard('green', 1);
    const eff = effectiveResearchCost(card, [fakeCard('green', 1, 'x')]);
    expect(eff.wood).toBe(T1_PRIMARY_AMOUNT - 1);
    expect(eff.gold).toBe(0);
    expect(eff.science).toBe(0);
    expect(eff.production).toBe(0);
  });
});
