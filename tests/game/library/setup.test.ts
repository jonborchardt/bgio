// SL 2.2 — buildLibrary tests.
//
// Drive the deck builder against a fixed-seed random so the shuffle is
// deterministic. With no content tagged yet (sub-plan 6 hasn't landed),
// the deck is empty — we still verify shape invariants and the
// cross-tier ordering invariant on whatever cards are present.

import { describe, expect, it } from 'vitest';
import { fromBgio, type BgioRandomLike } from '../../../src/game/random.ts';
import { buildLibrary } from '../../../src/game/library/setup.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';

const identityRandom = (): BgioRandomLike => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
});

describe('SL 2.2 — buildLibrary', () => {
  it('produces a length-6 row', () => {
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0', '1']);
    expect(lib.row).toHaveLength(6);
  });

  it('total cards in row + deck + lostIdeas have no duplicates', () => {
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0', '1', '2', '3']);
    const all: LibraryCard[] = [
      ...lib.row.filter((c): c is LibraryCard => c !== null),
      ...lib.deck,
      ...lib.lostIdeas,
    ];
    // Defs are stable references back into the frozen JSON loader, so
    // identity equality is the right test for duplicates.
    const seen = new Set<unknown>();
    for (const c of all) {
      expect(seen.has(c.def)).toBe(false);
      seen.add(c.def);
    }
  });

  it('lostIdeas starts empty', () => {
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0']);
    expect(lib.lostIdeas).toEqual([]);
  });

  it('discountTableaus has one empty array per seat', () => {
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0', '1', '2']);
    expect(Object.keys(lib.discountTableaus).sort()).toEqual(['0', '1', '2']);
    for (const seat of ['0', '1', '2']) {
      expect(lib.discountTableaus[seat]).toEqual([]);
    }
  });

  it('tier ordering: every deck card at index N has tier <= every later card', () => {
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0']);
    // Concatenated deck is row first, then deck — but the master plan
    // says draw order is "T1 first, T2, T3" and the row is dealt off
    // the top, so the row's cards are also tier-sorted relative to
    // the deck. Concretely: row[0..5] then deck[0..] should be a
    // non-decreasing tier sequence.
    const sequence: LibraryCard[] = [
      ...lib.row.filter((c): c is LibraryCard => c !== null),
      ...lib.deck,
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]!.tier).toBeGreaterThanOrEqual(
        sequence[i - 1]!.tier,
      );
    }
  });

  it('with tagged content (post sub-plan 6), the row fills with library cards and the deck is non-empty', () => {
    // Sub-plan 6 backfilled `tier` / `scienceColor` across buildings,
    // units, technologies, and chief events, so `collectTaggedCards`
    // returns a populated set and the row deals down to library cards.
    // This test pins that contract so a regression in
    // `collectTaggedCards` (e.g. accidentally dropping every def) shows
    // up immediately.
    const r = fromBgio(identityRandom());
    const lib = buildLibrary(r, ['0']);
    const filledSlots = lib.row.filter((s) => s !== null);
    expect(filledSlots.length).toBe(6);
    expect(lib.deck.length).toBeGreaterThan(0);
  });
});
