// Center mat — per-player resource circles + a single trade-request slot.
//
// Models the central play area: every non-chief seat owns one resource circle
// (where role-specific moves drop tokens this round); the Foreign player can
// also place a single trade request. Circles are swept back into the bank at
// the end of every round; the trade request persists until fulfilled or
// explicitly discarded.
//
// All mutating helpers run under Immer (called from inside boardgame.io moves
// or `endOfRound.onBegin`), so they mutate `mat` directly.

import type { PlayerID, Role } from '../types.ts';
import type { ResourceBag } from './types.ts';
import { RESOURCES } from './types.ts';
import { bagOf, canAfford } from './bag.ts';
import { transfer } from './bank.ts';
import { registerRoundEndHook } from '../hooks.ts';

export interface TradeRequest {
  id: string;
  // The seat acting as the trading partner (the Foreign-side mat circle).
  ownerSeat: PlayerID;
  required: ResourceBag;
  reward: ResourceBag;
}

export interface CenterMat {
  // One circle per non-chief seat. Indexed by seat (PlayerID). A seat that
  // only holds the `chief` role gets no entry — see `initialMat`.
  circles: Record<PlayerID, ResourceBag>;
  // 0 or 1 active trade request at any time. Persists across rounds.
  tradeRequest: TradeRequest | null;
}

// Builds one circle per non-chief seat. A seat is "non-chief" iff it does
// NOT hold the `chief` role. The single-player game stacks every role —
// including `chief` — onto seat 0, so seat 0 is the chief seat and produces
// no circle (mat helpers below are never called in normal 1-player flow).
export const initialMat = (
  assignments: Record<PlayerID, Role[]>,
): CenterMat => {
  const circles: Record<PlayerID, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(assignments)) {
    const isChiefSeat = roles.includes('chief');
    if (!isChiefSeat) {
      // bagOf({}) gives a fresh, mutable EMPTY-shaped bag (not the frozen
      // shared EMPTY_BAG constant) so Immer can subsequently mutate it.
      circles[seat] = bagOf({});
    }
  }
  return { circles, tradeRequest: null };
};

// Immer-mutating: drops `amounts` into the seat's circle. Throws if the seat
// has no circle (i.e., chief seat or a seat absent from this game). Callers
// that need a softer failure mode should convert to INVALID_MOVE in the move.
export const placeIntoCircle = (
  mat: CenterMat,
  seat: PlayerID,
  amounts: Partial<ResourceBag>,
): void => {
  const circle = mat.circles[seat];
  if (!circle) {
    throw new Error(
      `placeIntoCircle: no circle for seat '${seat}' (chief seat or absent)`,
    );
  }
  for (const r of RESOURCES) {
    const amt = amounts[r] ?? 0;
    if (amt === 0) continue;
    if (amt < 0) {
      throw new RangeError(
        `placeIntoCircle: negative amount for ${r} (${amt}); use pullFromCircle instead`,
      );
    }
    circle[r] += amt;
  }
};

// Immer-mutating: removes `amounts` from the seat's circle. Throws if the
// seat has no circle, or if any resource would underflow (the same shape of
// error the bank's `transfer` raises).
export const pullFromCircle = (
  mat: CenterMat,
  seat: PlayerID,
  amounts: Partial<ResourceBag>,
): void => {
  const circle = mat.circles[seat];
  if (!circle) {
    throw new Error(
      `pullFromCircle: no circle for seat '${seat}' (chief seat or absent)`,
    );
  }
  if (!canAfford(circle, amounts)) {
    for (const r of RESOURCES) {
      const need = amounts[r] ?? 0;
      if (circle[r] < need) {
        throw new RangeError(
          `pullFromCircle underflow on ${r} for seat '${seat}': have ${circle[r]}, need ${need}`,
        );
      }
    }
  }
  for (const r of RESOURCES) {
    const amt = amounts[r] ?? 0;
    if (amt === 0) continue;
    if (amt < 0) {
      throw new RangeError(
        `pullFromCircle: negative amount for ${r} (${amt}); use placeIntoCircle instead`,
      );
    }
    circle[r] -= amt;
  }
};

// Sets the (single) trade-request slot. Throws if a request already sits
// there — callers must call `clearTradeRequest` first. This invariant lets
// downstream code treat the slot as "writes are checked" rather than racing.
export const setTradeRequest = (mat: CenterMat, req: TradeRequest): void => {
  if (mat.tradeRequest !== null) {
    throw new Error(
      `setTradeRequest: a trade request is already present (id='${mat.tradeRequest.id}'); clear it first`,
    );
  }
  mat.tradeRequest = req;
};

// Clears the trade-request slot. Idempotent — clearing an empty slot is a
// no-op rather than an error, mirroring how bgio's own event helpers treat
// repeat calls.
export const clearTradeRequest = (mat: CenterMat): void => {
  mat.tradeRequest = null;
};

// ---------------------------------------------------------------------------
// Round-end hook: sweep leftover circle contents back into the bank.
// The trade-request slot is intentionally left alone — requests persist
// across rounds until fulfilled or discarded by the Foreign/Chief flows.
// ---------------------------------------------------------------------------

registerRoundEndHook('mat:sweep-leftovers', (G) => {
  for (const seat of Object.keys(G.centerMat.circles)) {
    const circle = G.centerMat.circles[seat]!;
    // Build the per-resource amounts to sweep — only non-zero slots, so we
    // skip needless work and avoid asking `transfer` for empty moves.
    const amounts: Partial<ResourceBag> = {};
    let any = false;
    for (const r of RESOURCES) {
      if (circle[r] > 0) {
        amounts[r] = circle[r];
        any = true;
      }
    }
    if (any) transfer(circle, G.bank, amounts);
  }
});
