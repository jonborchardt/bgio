// Defense redesign 2.1 — typed loader for src/data/trackCards.json.
//
// Mirrors the pattern in src/data/scienceCards.ts: validation runs at
// module load (per-card shape via `validateTrackCards` in
// schema.ts, plus the cross-card invariants below), and the result is
// deep-frozen so accidental mutation in game logic crashes loudly.
//
// Cross-card invariants enforced here (over and above schema.ts's per-card
// checks, which only see one entry at a time):
//   - all phases 1..10 have at least one card (D19);
//   - exactly one card has `kind: 'boss'`, in phase 10 (D21);
//   - card `id`s are unique.

import trackCardsRaw from './trackCards.json';
import { validateTrackCards } from './schema.ts';
import type { TrackCardDef } from './schema.ts';

const REQUIRED_PHASES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const enforceInvariants = (cards: TrackCardDef[]): TrackCardDef[] => {
  const seenIDs = new Set<string>();
  for (const card of cards) {
    if (seenIDs.has(card.id)) {
      throw new Error(`TrackCardDef: duplicate id "${card.id}"`);
    }
    seenIDs.add(card.id);
  }

  const phasesPresent = new Set(cards.map((c) => c.phase));
  for (const phase of REQUIRED_PHASES) {
    if (!phasesPresent.has(phase)) {
      throw new Error(
        `TrackCardDef: phase ${phase} has no cards — every phase 1..10 must be populated`,
      );
    }
  }

  const bossCards = cards.filter((c) => c.kind === 'boss');
  if (bossCards.length !== 1) {
    throw new Error(
      `TrackCardDef: expected exactly one boss card, got ${bossCards.length}`,
    );
  }
  const boss = bossCards[0];
  if (boss.phase !== 10) {
    throw new Error(
      `TrackCardDef: boss card "${boss.id}" must be in phase 10, got phase ${boss.phase}`,
    );
  }

  return cards;
};

// Deep-freeze the array and each entry so a downstream mutation (e.g. a
// reducer that pushed onto `card.attackPattern`) crashes loudly. Match
// the pattern used by other loaders.
const deepFreezeTrackCards = (
  arr: TrackCardDef[],
): ReadonlyArray<TrackCardDef> => {
  for (const entry of arr) {
    if (entry.kind === 'threat' && entry.modifiers) {
      Object.freeze(entry.modifiers);
    }
    if (entry.kind === 'boss') {
      Object.freeze(entry.thresholds);
      Object.freeze(entry.attackPattern);
      for (const ap of entry.attackPattern) Object.freeze(ap);
    }
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const TRACK_CARDS: ReadonlyArray<TrackCardDef> = deepFreezeTrackCards(
  enforceInvariants(validateTrackCards(trackCardsRaw)),
);
