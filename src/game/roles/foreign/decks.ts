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
import type { UnitDef } from '../../../data/schema.ts';
import type { ResourceBag } from '../../resources/types.ts';
import type { BattleInFlight, UnitInstance } from './types.ts';

export interface ForeignState {
  // The Foreign hand of unit cards available to recruit. Seeded with the
  // level-0 Militia entries at setup (07.2) — until UnitDef carries a
  // `level` field we treat the first 3 entries of `UNITS` as Militia.
  hand: UnitDef[];
  // Recruited units currently on the board, count-collapsed by `defID`
  // (07.2). `foreignRecruit` increments the matching entry or appends a
  // new one; `foreignReleaseUnit` decrements and removes at zero.
  inPlay: UnitInstance[];
  // Top of the deck = index 0 (drawn first). Lowest `number` cards on top.
  battleDeck: BattleCardDef[];
  tradeDeck: TradeCardDef[];
  // Active battle card + the units committed to fight it. Empty at setup;
  // the full flip-flow lands in 07.3 / 07.4.
  inFlight: BattleInFlight;
  // Set by `foreignUpkeep` once per `foreignTurn` stage so the move can't
  // run a second time and double-charge. Cleared at the start of the next
  // foreign stage by 02.2 / 07.x stage-entry plumbing.
  _upkeepPaid?: boolean;
  // 07.4 — outcome of the most recent battle resolved in `foreignAssignDamage`.
  // Cleared at the next `foreignFlipBattle`. The trade-flip move requires
  // this to equal 'win' (per game-design.md "Flipping a trade card is only
  // allowed after a winning battle").
  lastBattleOutcome?: 'win' | 'lose';
  // 07.4 — tribute scheduled when a battle resolves to 'lose'. The chief's
  // next phase consumes this (or a later 07.x sub-plan does); for now we
  // just record it on G so the move's lose-path is observable.
  pendingTribute?: Partial<ResourceBag>;
  // 07.5 — a trade card drawn while the mat's tradeRequest slot is already
  // occupied. Held here until the chief decides which card to keep via
  // `chiefDecideTradeDiscard`. Paired with `G._awaitingChiefTradeDiscard`.
  pendingTrade?: TradeCardDef;
  // Last release transaction, retained so `foreignUndoRelease` can reverse
  // it. Set by `foreignReleaseUnit` on success; consumed (and cleared) by
  // `foreignUndoRelease`. bgio's own UNDO action is blocked at the master
  // level whenever multiple players are simultaneously active via
  // `setActivePlayers`, so we model release-undo as a real player move.
  _lastRelease?: { defID: string; count: number; refundTotal: number };
  // Per-defID count of units recruited during the current foreign turn.
  // Newly recruited units are exempt from upkeep on the turn they were
  // bought, so this map is subtracted from `inPlay` when computing the
  // upkeep bill and when gating `foreignSeatDone`. Cleared at end-of-round
  // alongside `_upkeepPaid`.
  _recruitedThisTurn?: Record<string, number>;
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
