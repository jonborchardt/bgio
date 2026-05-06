// Science Library SL 3.3 — end-of-turn row refill.
//
// Walks `G.library.row` left-to-right and fills every `null` slot from
// the front of `G.library.deck`. Stops when the row has no more nulls
// or the deck is empty. No shuffle — only setup shuffles the deck.

import type { LibraryState } from './state.ts';

export const refillLibraryRow = (lib: LibraryState): void => {
  for (let i = 0; i < lib.row.length; i++) {
    if (lib.row[i] !== null) continue;
    if (lib.deck.length === 0) break;
    lib.row[i] = lib.deck.shift()!;
  }
};
