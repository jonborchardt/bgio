// Resource-related boardgame.io moves and shared spend helpers.
//
// `pullFromMat` is the canonical way for a non-chief seat to drain tokens
// the chief placed on their action circle into their per-seat wallet. The
// circle / bank / wallet primitives that this move composes live under
// `bag.ts`, `bank.ts`, and `centerMat.ts`; the move's job is just to gate
// permissions and stitch the helpers together with INVALID_MOVE conversion
// on the failure paths.
//
// `payFromWallet` is the corresponding spend helper used by every other
// role's purchase moves (Science / Domestic / Foreign) — it wraps `transfer`
// from the seat's wallet to the bank and throws RangeError on underflow so
// the calling move can convert to INVALID_MOVE.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { PlayerID, SettlementState } from '../types.ts';
import type { ResourceBag } from './types.ts';
import { canAfford, findInvalidAmount } from './bag.ts';
import { transfer } from './bank.ts';
import { rolesAtSeat } from '../roles.ts';

/**
 * Move: a non-chief seat pulls `amounts` from its own mat circle into its
 * per-seat wallet. Returns INVALID_MOVE (and leaves state untouched) if:
 *   - the caller is missing or holds the chief role,
 *   - the caller has no circle on the mat (shouldn't happen for a valid
 *     non-chief seat, but defensive),
 *   - the caller has no wallet (same — defensive against a malformed state),
 *   - the caller's circle can't afford the requested amounts.
 *
 * Phase / stage gating happens at the bgio config layer (see plan 02.x),
 * not here — this move stays a thin permission/affordability shell.
 */
export const pullFromMat: Move<SettlementState> = (
  { G, playerID },
  amounts: Partial<ResourceBag>,
) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args
  // (not on `ctx`). Headless tests that call the move function directly
  // must include it on the first arg. Spectator / unauthenticated calls
  // arrive as `playerID === undefined`.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  const roles = rolesAtSeat(G.roleAssignments, playerID);
  if (roles.length === 0) return INVALID_MOVE;
  if (roles.includes('chief')) return INVALID_MOVE;

  // Reject negative / non-finite / non-integer amounts before any
  // affordability check. Without this gate `canAfford` returns true
  // for negatives (0 < -5 is false), and `transfer` would mint
  // resources from nothing.
  if (typeof amounts !== 'object' || amounts === null) return INVALID_MOVE;
  if (findInvalidAmount(amounts) !== null) return INVALID_MOVE;

  const circle = G.centerMat.circles[playerID];
  if (!circle) return INVALID_MOVE;

  const wallet = G.wallets[playerID];
  if (!wallet) return INVALID_MOVE;

  // Pre-check affordability so the mutation paths below can't half-apply.
  // `pullFromCircle` would throw on underflow but Immer's draft would still
  // reflect any successful per-resource decrement that ran before the throw —
  // checking up front keeps the move atomic by construction.
  if (!canAfford(circle, amounts)) return INVALID_MOVE;

  // Draining a circle into a wallet is conceptually the same as `transfer`
  // (mat circle → wallet bag), and `transfer` already does the per-resource
  // arithmetic with the affordability re-check. Reuse it rather than calling
  // `pullFromCircle` + `add` separately, which would allocate a new bag and
  // fight Immer.
  transfer(circle, wallet, amounts);
};

/**
 * Helper used by Science / Domestic / Foreign purchase moves: deducts
 * `cost` from the seat's wallet and credits the bank. Throws RangeError on
 * underflow (matching `transfer`'s contract); callers convert that to
 * INVALID_MOVE in their own move bodies.
 *
 * Throws a plain Error when the seat has no wallet on G — that's a logic
 * bug at the call site (e.g., trying to charge the chief seat for a
 * purchase), not a player-recoverable condition.
 */
export const payFromWallet = (
  G: SettlementState,
  playerID: PlayerID,
  cost: Partial<ResourceBag>,
): void => {
  const wallet = G.wallets[playerID];
  if (!wallet) {
    throw new Error(
      `payFromWallet: no wallet for seat '${playerID}' (chief seat or absent)`,
    );
  }
  transfer(wallet, G.bank, cost);
};

// The two helpers above also re-exported via the moves barrel so other move
// modules can import them by their natural name.

// `pullFromCircle` is intentionally NOT re-exported — it's an internal
// primitive of `centerMat.ts`. The only sanctioned way to drain a circle
// from inside a move is `pullFromMat` (which handles permissions) or
// `transfer` (which doesn't enforce mat invariants but at least validates
// affordability). Importing `pullFromCircle` directly skips both layers.
