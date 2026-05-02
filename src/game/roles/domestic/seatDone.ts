// domesticSeatDone (14.2) — the Domestic seat declares its turn finished.
//
// Flips `G.othersDone[playerID] = true`. bgio re-evaluates
// `othersPhase.endIf` after the move resolves; once every non-chief
// seat has flipped done, the engine transitions to `endOfRound`.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const domesticSeatDone: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  clearUndoable(G);
  if (!G.othersDone) G.othersDone = {};
  G.othersDone[playerID] = true;
};
