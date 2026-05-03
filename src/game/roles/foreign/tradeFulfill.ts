// foreignTradeFulfill — the chief completes the active trade request:
// the bank pays `required` to the off-table trader, receives `reward`
// back, the village's `settlementsJoined` counter ticks (a "tribute
// trade" win-condition input), and the slot clears.
//
// Chief-only: only the seat holding `chief` may fulfill. The trade
// request is private to the chief (see `playerView`'s
// `centerMat.tradeRequest` redaction) — non-chief viewers don't see
// what was flipped. The `ownerSeat` field still records which Foreign
// seat flipped the card (audit / UI labeling) but plays no role in
// fulfillment.
//
// Bank accounting: the trader is off-table (mirrors how the chief
// stipend mints gold into the bank from off-table at every chief
// phase). We direct-mutate `G.bank` rather than route through
// `transfer`, because there is no second on-table holder to debit or
// credit. The bank log carries the signed deltas:
//   - `required` is logged as 'stashPayment' with a negated bag so the
//     chief tooltip lists the spend alongside other chief outflows.
//   - `reward` is logged as 'distribute' with the positive reward bag.
//
// The move-name prefix `foreign...` is historical (this used to be a
// foreign-only move). We keep the name to avoid churning the move
// registry / clients; semantically it is now a chief-only move.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { canAfford } from '../../resources/bag.ts';
import { RESOURCES } from '../../resources/types.ts';
import { appendBankLog, negateBag } from '../../resources/bankLog.ts';
import { clearTradeRequest } from '../../resources/centerMat.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const foreignTradeFulfill: Move<SettlementState> = ({
  G,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  const req = G.centerMat.tradeRequest;
  if (req === null) return INVALID_MOVE;

  if (!canAfford(G.bank, req.required)) return INVALID_MOVE;

  clearUndoable(G);

  for (const r of RESOURCES) {
    G.bank[r] -= req.required[r];
    G.bank[r] += req.reward[r];
  }
  appendBankLog(
    G,
    'stashPayment',
    negateBag(req.required),
    'chief trade fulfill (required)',
  );
  appendBankLog(
    G,
    'distribute',
    req.reward,
    'chief trade fulfill (reward)',
  );

  G.settlementsJoined += 1;

  clearTradeRequest(G.centerMat);
};
