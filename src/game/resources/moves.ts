// Resource-related shared spend helpers.
//
// `payFromStash` is the canonical spend helper used by every non-chief
// role's purchase moves (Science / Domestic; Defense will join in
// Phase 2): it wraps `transfer` from the seat's `mats[seat].stash` to
// `G.bank` and throws RangeError on underflow so the calling move can
// convert to INVALID_MOVE. The bank-log entry is appended here so every
// spend site is automatically reflected in the chief tooltip.
//
// The older `pullFromMat` move was deleted as part of the player-mat
// redesign — `mats[seat].in` is drained into `mats[seat].stash`
// automatically when `othersPhase.turn.onBegin` runs (see
// phases/others.ts), so a player-driven "pull" step is no longer needed.

import type { PlayerID, SettlementState } from '../types.ts';
import type { ResourceBag } from './types.ts';
import { transfer } from './bank.ts';
import { appendBankLog, negateBag } from './bankLog.ts';
import { canAfford } from './bag.ts';
import { RESOURCES } from './types.ts';

/**
 * Helper used by Science / Domestic (and Phase 2 Defense) purchase
 * moves: deducts `cost` from the seat's stash and credits the bank.
 * Throws RangeError on underflow (matching `transfer`'s contract);
 * callers convert that to INVALID_MOVE in their own move bodies.
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

/**
 * Stash-or-bank fallback used by Library buys when the science seat is
 * also the chief seat (1p / 2p / 3p assignments). In those layouts there
 * is no `mats[chiefSeat]` — the chief acts on `G.bank` directly — so
 * `payFromStash` would throw. This helper forks on the presence of a mat:
 *
 *   - mat present → identical to `payFromStash` (deduct from stash,
 *     credit the bank, append a `'stashPayment'` log entry).
 *   - mat absent  → deduct from `G.bank` directly and append a
 *     `'stashPayment'` log entry tagged with the seat so the audit trail
 *     captures the spend.
 *
 * Affordability is the caller's job — this helper throws on underflow,
 * matching `payFromStash`.
 */
export const payFromStashOrBank = (
  G: SettlementState,
  playerID: PlayerID,
  cost: Partial<ResourceBag>,
  source: 'stashPayment' = 'stashPayment',
): void => {
  const mat = G.mats?.[playerID];
  if (mat !== undefined) {
    transfer(mat.stash, G.bank, cost);
    appendBankLog(G, source, cost, `from seat ${playerID}`);
    return;
  }
  if (!canAfford(G.bank, cost)) {
    for (const r of RESOURCES) {
      const need = cost[r] ?? 0;
      if (G.bank[r] < need) {
        throw new RangeError(
          `payFromStashOrBank underflow on ${r}: bank has ${G.bank[r]}, need ${need}`,
        );
      }
    }
  }
  for (const r of RESOURCES) {
    const amt = cost[r] ?? 0;
    if (amt === 0) continue;
    G.bank[r] -= amt;
  }
  appendBankLog(G, source, negateBag(cost), `from seat ${playerID} (bank)`);
};

/**
 * Affordability counterpart for `payFromStashOrBank`: when the seat has
 * no mat, the affordability check has to fall back to `G.bank` rather
 * than the (nonexistent) stash.
 */
export const canAffordFromStashOrBank = (
  G: SettlementState,
  playerID: PlayerID,
  cost: Partial<ResourceBag>,
): boolean => {
  const mat = G.mats?.[playerID];
  if (mat !== undefined) return canAfford(mat.stash, cost);
  return canAfford(G.bank, cost);
};
