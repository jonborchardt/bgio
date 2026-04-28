// 07.5 — Trade-request placement & chief-discard interrupt.
//
// `placeOrInterruptTrade` is called from inside `foreignFlipTrade` (07.4)
// after a card is drawn from the Trade deck. It either drops the new
// request straight into `G.centerMat.tradeRequest`, or — when the slot is
// already occupied — stashes the new card in `G.foreign.pendingTrade` and
// flips `G._awaitingChiefTradeDiscard = true` so the chief picks which to
// keep on their next decision via `chiefDecideTradeDiscard`.
//
// V1 simplification (deviation from the plan's `enterEventStage`-style
// helper signature): bgio's `events.setStage` acts on the *calling* seat,
// so a Foreign-stage move can't push the Chief seat into the
// `awaitingChiefDecision` stage from inside its own move body. We use a
// G-flag instead, which the chief's decision move gates on directly. The
// gameplay shape is the same — the request is held, no other move can
// place a competing trade, and the chief resolves it before any further
// trade flips can happen.
//
// Pure helper: not a bgio Move. Mutates `G` directly under Immer.

import type { SettlementState } from '../../types.ts';
import type { TradeCardDef } from '../../../data/decks.ts';
import type { PlayerID } from '../../types.ts';
import type { TradeRequest } from '../../resources/centerMat.ts';
import { setTradeRequest } from '../../resources/centerMat.ts';
import { bagOf } from '../../resources/bag.ts';

/**
 * Build a `TradeRequest` from a freshly-drawn `TradeCardDef`. The owner
 * seat is the Foreign-side mat circle — i.e. the seat that flipped the
 * card. `required` and `reward` get widened from `Partial<ResourceBag>`
 * to a fully-shaped `ResourceBag` (zero-filled) via `bagOf` so downstream
 * `pullFromCircle` / `transfer` calls don't have to do their own widening.
 */
const tradeRequestFromCard = (
  drawn: TradeCardDef,
  ownerSeat: PlayerID,
): TradeRequest => ({
  id: drawn.id,
  ownerSeat,
  required: bagOf(drawn.required),
  reward: bagOf(drawn.reward),
});

/**
 * Place a freshly-drawn trade card into the mat slot, OR — if the slot is
 * already occupied — stash the card on `G.foreign.pendingTrade` and flip
 * `G._awaitingChiefTradeDiscard` so the chief picks via
 * `chiefDecideTradeDiscard` (07.5).
 *
 * The `ownerSeat` is the Foreign seat (the one drawing). Caller is
 * responsible for stage / role gating; this helper trusts it.
 */
export const placeOrInterruptTrade = (
  G: SettlementState,
  drawn: TradeCardDef,
  ownerSeat: PlayerID,
): void => {
  if (G.foreign === undefined) {
    throw new Error('placeOrInterruptTrade: G.foreign is undefined');
  }

  if (G.centerMat.tradeRequest === null) {
    setTradeRequest(G.centerMat, tradeRequestFromCard(drawn, ownerSeat));
    return;
  }

  // Slot occupied — stash and flag. The chief resolves via
  // `chiefDecideTradeDiscard`. We don't refund the existing request's
  // partial deposits here — that decision (refund vs keep) is the chief's,
  // and the discard move handles it on resolution.
  G.foreign.pendingTrade = drawn;
  G._awaitingChiefTradeDiscard = true;
};

// Exposed for the chief's discard-decision move so it doesn't have to
// duplicate the widening logic when promoting the pending card into the
// mat slot.
export { tradeRequestFromCard };
