// Science Library SL 6 — content coverage test.
//
// After sub-plan 6 tags every building / unit / tech / chief-event with
// `tier` (1|2|3) and `scienceColor` (gold|blue|green|red), the Library
// deck must hold at least 5 cards in each of the 4 × 3 = 12 buckets
// (per the master plan: "5 cards per color per tier × 4 colors × 3
// tiers = 60 cards in the deck").
//
// This test reads BUILDINGS / UNITS / TECHNOLOGIES / EVENT_CARDS through
// the typed loaders, filters to the entries that carry both library tags,
// and asserts every (color, tier) bucket has ≥5 cards.
//
// Pre-existing schema tests cover the "tags are well-formed when present"
// invariant; this test covers the "every bucket has enough content"
// invariant.

import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNITS, TECHNOLOGIES } from '../../src/data/index.ts';
import { EVENT_CARDS } from '../../src/data/events.ts';
import type { LibraryColor, LibraryTier } from '../../src/data/schema.ts';

const COLORS: ReadonlyArray<LibraryColor> = ['gold', 'blue', 'green', 'red'];
const TIERS: ReadonlyArray<LibraryTier> = [1, 2, 3];
const FLOOR = 5;

interface TaggedCard {
  source: string;
  name: string;
  tier: LibraryTier;
  scienceColor: LibraryColor;
}

const collectTagged = (): TaggedCard[] => {
  const out: TaggedCard[] = [];
  for (const b of BUILDINGS) {
    if (b.tier !== undefined && b.scienceColor !== undefined) {
      out.push({
        source: 'building',
        name: b.name,
        tier: b.tier,
        scienceColor: b.scienceColor,
      });
    }
  }
  for (const u of UNITS) {
    if (u.tier !== undefined && u.scienceColor !== undefined) {
      out.push({
        source: 'unit',
        name: u.name,
        tier: u.tier,
        scienceColor: u.scienceColor,
      });
    }
  }
  for (const t of TECHNOLOGIES) {
    if (t.tier !== undefined && t.scienceColor !== undefined) {
      out.push({
        source: 'tech',
        name: t.name,
        tier: t.tier,
        scienceColor: t.scienceColor,
      });
    }
  }
  for (const e of EVENT_CARDS) {
    if (e.tier !== undefined && e.scienceColor !== undefined) {
      out.push({
        source: 'event',
        name: e.name,
        tier: e.tier,
        scienceColor: e.scienceColor,
      });
    }
  }
  return out;
};

describe('Science Library content coverage (SL 6)', () => {
  const tagged = collectTagged();

  it('every (color, tier) bucket has at least 5 tagged cards', () => {
    for (const color of COLORS) {
      for (const tier of TIERS) {
        const bucket = tagged.filter(
          (c) => c.scienceColor === color && c.tier === tier,
        );
        expect(
          bucket.length,
          `bucket (${color}, T${tier}) has ${bucket.length} cards (need ≥${FLOOR})`,
        ).toBeGreaterThanOrEqual(FLOOR);
      }
    }
  });

  it('total tagged card count is at least 60 (5 × 4 × 3)', () => {
    expect(tagged.length).toBeGreaterThanOrEqual(60);
  });

  it('every tagged tier value is 1|2|3', () => {
    for (const c of tagged) {
      expect([1, 2, 3]).toContain(c.tier);
    }
  });

  it('every tagged scienceColor value is gold|blue|green|red', () => {
    for (const c of tagged) {
      expect(['gold', 'blue', 'green', 'red']).toContain(c.scienceColor);
    }
  });

  it('all buildings carry the green scienceColor tag', () => {
    // Buildings always distribute to domestic; the tag must be `green`
    // for the recipient routing in scienceLibraryBuy to land them in
    // the right hand.
    for (const b of BUILDINGS) {
      if (b.scienceColor !== undefined) {
        expect(b.scienceColor, `${b.name}.scienceColor`).toBe('green');
      }
    }
  });

  it('all units carry the red scienceColor tag', () => {
    // Units always distribute to defense; analogous to the building rule
    // above.
    for (const u of UNITS) {
      if (u.scienceColor !== undefined) {
        expect(u.scienceColor, `${u.name}.scienceColor`).toBe('red');
      }
    }
  });

  it('all tagged events carry the gold scienceColor tag', () => {
    // Per the SL 6 plan only chief (gold) events join the library.
    for (const e of EVENT_CARDS) {
      if (e.scienceColor !== undefined) {
        expect(e.scienceColor, `${e.name}.scienceColor`).toBe('gold');
      }
    }
  });
});
