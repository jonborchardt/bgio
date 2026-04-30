// foreignUndoRelease — reverse the most recent `foreignReleaseUnit` on this
// seat. We model this as a real move (rather than bgio's UNDO action) because
// bgio's master rejects UNDO whenever multiple players are simultaneously
// active via `setActivePlayers` — which is exactly our `othersPhase` setup.
//
// Reads `G.foreign._lastRelease` (set by `foreignReleaseUnit`) to know the
// `defID`, count, and refund to roll back. Re-adds the units to `inPlay`,
// pays the refund back into the bank, logs the reverse, and clears
// `_lastRelease` so a stale undo cannot fire again.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { appendBankLog } from '../../resources/bankLog.ts';

export const foreignUndoRelease: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'foreignTurn') return INVALID_MOVE;

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  const last = foreign._lastRelease;
  if (last === undefined) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;

  // Player must still have the refund in stash to return it to the bank.
  if (mat.stash.gold < last.refundTotal) return INVALID_MOVE;

  // Re-add the released units to inPlay (merge with an existing entry or
  // append a new row, matching `foreignRecruit`'s shape).
  const idx = foreign.inPlay.findIndex((u) => u.defID === last.defID);
  if (idx === -1) {
    foreign.inPlay.push({ defID: last.defID, count: last.count });
  } else {
    foreign.inPlay[idx]!.count += last.count;
  }

  // Reverse the refund: pull gold back out of the seat's stash and into the
  // bank. The bank log records this as a positive inflow (mirror of the
  // negative `release` entry).
  if (last.refundTotal > 0) {
    mat.stash.gold -= last.refundTotal;
    G.bank.gold += last.refundTotal;
    appendBankLog(
      G,
      'release',
      { gold: last.refundTotal },
      `Undo release ${last.defID}${last.count > 1 ? ` ×${last.count}` : ''}`,
    );
  }

  foreign._lastRelease = undefined;
};
