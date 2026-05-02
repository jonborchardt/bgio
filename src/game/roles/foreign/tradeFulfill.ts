// foreignTradeFulfill — any active seat can complete the active trade
// request on the center mat: pays `required` from their own stash to
// the bank, receives `reward` into their own stash, increments the
// village's `settlementsJoined` counter (a "tribute trade" win-condition
// input), and clears the slot.
//
// The trade slot is shared/public: the `ownerSeat` field still records
// which Foreign seat flipped the card (useful for audit / UI labeling),
// but it does NOT restrict who can pay. Any seat — chief in chiefPhase,
// or any non-chief seat in their own active stage during othersPhase —
// may fulfill, paying from and receiving into their own stash.
//
// V1 design choices:
//   - Required goods come straight from the calling seat's `stash`. No
//     partial payment — fulfill is all-or-nothing.
//   - Reward goes into the calling seat's `stash`.
//   - `settlementsJoined += 1` per completed trade. The win condition
//     in `endConditions.ts` triggers at >= 10.
//   - Bank log uses the existing `stashPayment` source for the `required`
//     transfer (so the chief tooltip shows "from seat N — trade fulfill")
//     and the reward outflow is logged as `distribute` to keep the audit
//     symmetry with chief drops.
//
// The move-name prefix `foreign...` is historical (this used to be a
// foreign-only move). We keep the name to avoid churning the move
// registry / clients; semantically it is now a center-mat move.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { canAfford } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { appendBankLog, negateBag } from '../../resources/bankLog.ts';
import { payFromStash } from '../../resources/moves.ts';
import { clearTradeRequest } from '../../resources/centerMat.ts';
import { clearUndoable } from '../../undo.ts';

export const foreignTradeFulfill: Move<SettlementState> = ({
  G,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  const req = G.centerMat.tradeRequest;
  if (req === null) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;

  if (!canAfford(mat.stash, req.required)) return INVALID_MOVE;

  clearUndoable(G);

  // Pay required → bank (logged as a stash payment so the chief tooltip
  // can attribute it to this seat).
  payFromStash(G, playerID, req.required);

  // Reward bank → stash. We re-use the bank-log `distribute` source
  // because it already means "bank handed tokens to a seat" in the
  // tooltip; the `detail` line discriminates.
  transfer(G.bank, mat.stash, req.reward);
  appendBankLog(
    G,
    'distribute',
    negateBag(req.reward),
    `trade fulfill reward to seat ${playerID}`,
  );

  G.settlementsJoined += 1;

  clearTradeRequest(G.centerMat);
};
