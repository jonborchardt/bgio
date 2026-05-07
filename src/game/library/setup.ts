// Science Library SL 2.2 — deck construction at setup.
//
// Pulls every tagged card from the typed loaders, splits into three
// tier-stacks, shuffles each independently, concatenates T1→T2→T3, deals
// the first 6 to `row`, and leaves the rest in `deck`. Per-seat
// `discountTableaus` start empty.

import type { LibraryCard } from './types.ts';
import {
  buildingToLibraryCard,
  unitToLibraryCard,
  techToLibraryCard,
  eventToLibraryCard,
} from './types.ts';
import type { LibraryState } from './state.ts';
import { emptyLibraryState } from './state.ts';
import type { PlayerID } from '../types.ts';
import type { RandomAPI } from '../random.ts';
import { BUILDINGS, UNITS, TECHNOLOGIES, EVENT_CARDS } from '../../data/index.ts';

// Issue 056h — exported so refill.ts and tests don't hardcode `6`.
export const ROW_SIZE = 6;

// Walk every loader, lift the tagged defs into LibraryCards, and
// return one flat list. Untagged content (the V1 default) is skipped —
// sub-plan 6 back-fills the JSON, at which point this collects real
// cards instead of an empty list.
const collectTaggedCards = (): LibraryCard[] => {
  const out: LibraryCard[] = [];
  for (const def of BUILDINGS) {
    const card = buildingToLibraryCard(def);
    if (card !== null) out.push(card);
  }
  for (const def of UNITS) {
    const card = unitToLibraryCard(def);
    if (card !== null) out.push(card);
  }
  for (const def of TECHNOLOGIES) {
    // Issue 019 — `libraryExempt` techs ship in TECHNOLOGIES (so the
    // unlock-text path still works when a downstream tech names them),
    // but they don't appear in the library deck and so can't be bought
    // or burned. Skipping here is the only call site that needs to
    // honor the flag; the rest of the engine reads techs through other
    // surfaces (relationships graph, role hands, …) where the flag is
    // intentionally ignored.
    if (def.libraryExempt === true) continue;
    const card = techToLibraryCard(def);
    if (card !== null) out.push(card);
  }
  for (const def of EVENT_CARDS) {
    const card = eventToLibraryCard(def);
    if (card !== null) out.push(card);
  }
  return out;
};

export const buildLibrary = (
  random: RandomAPI,
  seats: ReadonlyArray<PlayerID>,
): LibraryState => {
  const all = collectTaggedCards();

  const t1 = all.filter((c) => c.tier === 1);
  const t2 = all.filter((c) => c.tier === 2);
  const t3 = all.filter((c) => c.tier === 3);

  const shuffled: LibraryCard[] = [
    ...random.shuffle(t1),
    ...random.shuffle(t2),
    ...random.shuffle(t3),
  ];

  const state = emptyLibraryState(seats);
  // Deal the top ROW_SIZE cards into the row in slot order. Smaller
  // decks (V1, before content tagging) gracefully fall short — slots
  // beyond the deck stay null.
  for (let i = 0; i < ROW_SIZE && shuffled.length > 0; i++) {
    state.row[i] = shuffled.shift()!;
  }
  state.deck = shuffled;
  return state;
};
