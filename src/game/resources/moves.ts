// Resource-related shared spend helpers.
//
// `payFromStash` is the canonical spend helper used by every non-chief
// role's purchase moves (Science / Domestic / Foreign): it wraps
// `transfer` from the seat's `mats[seat].stash` to `G.bank` and throws
// RangeError on underflow so the calling move can convert to
// INVALID_MOVE. The bank-log entry is appended here so every spend site
// is automatically reflected in the chief tooltip.
//
// The older `pullFromMat` move was deleted as part of the player-mat
// redesign — `mats[seat].in` is drained into `mats[seat].stash`
// automatically when `othersPhase.turn.onBegin` runs (see
// phases/others.ts), so a player-driven "pull" step is no longer needed.

import type { PlayerID, SettlementState } from '../types.ts';
import type { ResourceBag } from './types.ts';
import { transfer } from './bank.ts';
import { appendBankLog } from './bankLog.ts';

/**
 * Helper used by Science / Domestic / Foreign purchase moves: deducts
 * `cost` from the seat's stash and credits the bank. Throws RangeError on
 * underflow (matching `transfer`'s contract); callers convert that to
 * INVALID_MOVE in their own move bodies.
 *
 * Throws a plain Error when the seat has no mat on G — that's a logic
 * bug at the call site (e.g., trying to charge the chief seat for a
 * purchase), not a player-recoverable condition.
 */
export const payFromStash = (
  G: SettlementState,
  playerID: PlayerID,
  cost: Partial<ResourceBag>,
): void => {
  const mat = G.mats?.[playerID];
  if (mat === undefined) {
    throw new Error(
      `payFromStash: no mat for seat '${playerID}' (chief seat or absent)`,
    );
  }
  transfer(mat.stash, G.bank, cost);
  appendBankLog(G, 'stashPayment', cost, `from seat ${playerID}`);
};
