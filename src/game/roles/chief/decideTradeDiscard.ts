// 07.5 — `chiefDecideTradeDiscard`.
//
// Resolves the trade-request collision interrupt set up by 07.5's
// `placeOrInterruptTrade` helper: a Foreign trade flip landed on top of
// an already-occupied `centerMat.tradeRequest` slot, so the new card
// sits in `G.foreign.pendingTrade` and `G._awaitingChiefTradeDiscard` is
// flipped on. The chief now picks which to keep.
//
// keep === 'existing': discard the pending card. The mat slot is
//   unchanged. (Per game-design.md the discarded card's deposited
//   resources, if any, return to the bank — but a freshly-drawn pending
//   card has no deposits yet, so there's nothing to refund here.)
//
// keep === 'new': clear the existing mat slot's TradeRequest (any partial
//   deposits on the OWNER's mat circle are swept to the bank by the
//   round-end `mat:sweep-leftovers` hook anyway; the V1 simplification
//   here is that we don't proactively refund mid-round — the existing
//   request is just abandoned). Then promote the pending card into the
//   mat slot.
//
// V1 deviation from the plan: the plan calls for proactive refund of
// "Goods on the discarded card" when keeping 'new'. In our model the
// trade request is a *demand* — partial deposits made by buyers go into
// the OWNER's mat circle and are refundable through the existing
// circle-pull / round-end hook. To avoid double-counting we leave them
// where they are; the round-end sweep returns them. The simplification
// is documented at the bottom of `tradeRequest.ts` and in the test file.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import {
  setTradeRequest,
  clearTradeRequest,
} from '../../resources/centerMat.ts';
import { tradeRequestFromCard } from '../foreign/tradeRequest.ts';

export type TradeDiscardChoice = 'existing' | 'new';

export const chiefDecideTradeDiscard: Move<SettlementState> = (
  { G, playerID },
  keep: TradeDiscardChoice,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  if (G._awaitingChiefTradeDiscard !== true) return INVALID_MOVE;

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;
  const pending = foreign.pendingTrade;
  if (pending === undefined) return INVALID_MOVE;

  if (keep !== 'existing' && keep !== 'new') return INVALID_MOVE;

  if (keep === 'new') {
    // Drop the existing request (its owner's circle deposits are the
    // round-end sweep's problem — see header comment) and promote the
    // pending card. The pending TradeRequest's owner is the Foreign
    // seat that flipped it, which we recover from the existing slot
    // (the Foreign seat is the same in either case). Defensive lookup:
    // if for some reason the existing slot already cleared, the pending
    // card's owner is whichever non-chief seat holds 'foreign'. In
    // practice the helper only fires when the slot is occupied, so the
    // existing.ownerSeat read is safe.
    const ownerSeat =
      G.centerMat.tradeRequest?.ownerSeat ??
      Object.keys(G.roleAssignments).find((s) =>
        G.roleAssignments[s]?.includes('foreign'),
      ) ??
      playerID;
    clearTradeRequest(G.centerMat);
    setTradeRequest(G.centerMat, tradeRequestFromCard(pending, ownerSeat));
  }
  // keep === 'existing' ⇒ pending is discarded; mat slot stays put.

  foreign.pendingTrade = undefined;
  G._awaitingChiefTradeDiscard = false;
};
