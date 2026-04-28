// Foreign role — Battle and Trade deck construction.
//
// Per game-design.md §Setup.Foreign: "Sort by number, randomize each pile of
// the same number, stack with highest numbers at the bottom." That means the
// top of the deck (index 0, drawn first) is the lowest number. We implement
// the algorithm generically over any card type with a `.number` field, then
// specialize to Battle and Trade.
//
// Module-load side effects: none. The hand structure detail lands in 07.4.

import type { RandomAPI } from '../../random.ts';
import type { BattleCardDef, TradeCardDef } from '../../../data/decks.ts';
import { BATTLE_CARDS, TRADE_CARDS } from '../../../data/decks.ts';

export interface ForeignState {
  // Top of the deck = index 0 (drawn first). Lowest `number` cards on top.
  battleDeck: BattleCardDef[];
  tradeDeck: TradeCardDef[];
  // The Foreign hand. Detailed shape lands in 07.4 — for now the stable
  // contract is "an array Foreign owns", so playerView can size-redact it
  // alongside the decks.
  hand: unknown[];
}

/**
 * Group cards by `number`, shuffle each group via `random.shuffle`, then
 * concatenate in ascending number order. Generic over any card type carrying
 * a `number` field — used for both Battle and Trade decks.
 */
const buildDeck = <T extends { number: number }>(
  cards: ReadonlyArray<T>,
  random: RandomAPI,
): T[] => {
  // Group preserving insertion order of first-seen number — but we'll sort
  // ascending after shuffling each group, so insertion order doesn't matter.
  const groups = new Map<number, T[]>();
  for (const card of cards) {
    const bucket = groups.get(card.number);
    if (bucket === undefined) groups.set(card.number, [card]);
    else bucket.push(card);
  }

  const sortedNumbers = [...groups.keys()].sort((a, b) => a - b);
  const out: T[] = [];
  for (const n of sortedNumbers) {
    const group = groups.get(n)!;
    out.push(...random.shuffle(group));
  }
  return out;
};

export const buildBattleDeck = (random: RandomAPI): BattleCardDef[] =>
  buildDeck(BATTLE_CARDS, random);

export const buildTradeDeck = (random: RandomAPI): TradeCardDef[] =>
  buildDeck(TRADE_CARDS, random);

// Exported for tests so they can drive the deck-construction algorithm
// against a hand-rolled fixture without depending on the bundled JSON
// content.
export const __buildDeckForTest = buildDeck;
