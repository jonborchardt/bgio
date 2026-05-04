// defenseSeatDone (1.4) — the Defense seat declares its turn finished.
//
// Flips `G.othersDone[playerID] = true`. bgio re-evaluates
// `othersPhase.endIf` after the move resolves; once every non-chief
// seat has flipped done, the engine transitions to `endOfRound`.
//
// 1.4 stub: no upkeep gate (D14 retires upkeep entirely), no
// awaiting-damage interrupt stage. The Defense seat sits in
// `defenseTurn` and the only legal move is this one. Phase 2 will
// add `defenseBuy` / `defensePlay` and re-introduce richer gating; the
// seat-done move stays the same shape.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const defenseSeatDone: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('defense')) {
    return INVALID_MOVE;
  }
  const stage = ctx.activePlayers?.[playerID];
  if (stage !== 'defenseTurn') {
    return INVALID_MOVE;
  }

  clearUndoable(G);
  if (!G.othersDone) G.othersDone = {};
  G.othersDone[playerID] = true;
};
