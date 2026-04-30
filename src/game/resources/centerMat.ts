// Center mat — only the trade-request slot lives here now.
//
// The per-seat resource circles previously held by `circles[seat]` were
// folded into `G.mats[seat].in` / `out` in the player-mat redesign.
// What remains on the center mat is the single trade-request slot: a
// flipped Trade card that acts as a public "offer" the seat owning it
// can fulfill (or that the chief can discard via the interrupt flow).

import type { PlayerID } from '../types.ts';
import type { ResourceBag } from './types.ts';

export interface TradeRequest {
  id: string;
  // The seat acting as the trading partner (the Foreign-flipping seat).
  ownerSeat: PlayerID;
  required: ResourceBag;
  reward: ResourceBag;
}

export interface CenterMat {
  // 0 or 1 active trade request at any time. Persists across rounds.
  tradeRequest: TradeRequest | null;
}

export const initialCenterMat = (): CenterMat => ({
  tradeRequest: null,
});

// Sets the (single) trade-request slot. Throws if a request already sits
// there — callers must call `clearTradeRequest` first. This invariant
// lets downstream code treat the slot as "writes are checked" rather
// than racing.
export const setTradeRequest = (mat: CenterMat, req: TradeRequest): void => {
  if (mat.tradeRequest !== null) {
    throw new Error(
      `setTradeRequest: a trade request is already present (id='${mat.tradeRequest.id}'); clear it first`,
    );
  }
  mat.tradeRequest = req;
};

// Clears the trade-request slot. Idempotent — clearing an empty slot is a
// no-op rather than an error.
export const clearTradeRequest = (mat: CenterMat): void => {
  mat.tradeRequest = null;
};
