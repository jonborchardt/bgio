// Science Library SL 2.1 — runtime state shape.
//
// Lives at `G.library` (optional on `SettlementState` so older fixtures
// pre-dating this slice stay source-compatible). Built at setup by SL
// 2.2; mutated by SL 3.1 (buy) / 3.2 (burn) / 3.3 (refill).

import type { LibraryCard } from './types.ts';
import type { PlayerID } from '../types.ts';

export interface LibraryState {
  // Length 6. `null` slots open mid-turn as cards get bought/burned;
  // they refill from the deck at end-of-turn (SL 3.3). The slot index
  // is stable so the UI can render in place rather than reflowing.
  row: (LibraryCard | null)[];
  // Tier-stacked draw pile. `deck[0]` is the next card to flip; T1
  // cards come first, then T2, then T3 (built once at setup).
  deck: LibraryCard[];
  // Public face-up burn pile. The lost-ideas record is always
  // viewable — paths the village will never take.
  lostIdeas: LibraryCard[];
  // Per-seat record of bought cards; each card grants its
  // `discountResource(card)` discount on subsequent buys forever.
  // Every seat keyed even when empty so boss-debuff threshold readers
  // can index without guards.
  discountTableaus: Record<PlayerID, LibraryCard[]>;
}

// Empty initializer — tests build a `LibraryState` with no deck or
// row. The seat list is supplied so every seat key is present from
// the start.
export const emptyLibraryState = (
  seats: ReadonlyArray<PlayerID>,
): LibraryState => {
  const discountTableaus: Record<PlayerID, LibraryCard[]> = {};
  for (const seat of seats) discountTableaus[seat] = [];
  return {
    row: [null, null, null, null, null, null],
    deck: [],
    lostIdeas: [],
    discountTableaus,
  };
};
