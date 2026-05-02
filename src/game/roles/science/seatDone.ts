// scienceSeatDone (14.2) — the Science seat declares its turn finished.
//
// Flips `G.othersDone[playerID] = true`. bgio re-evaluates
// `othersPhase.endIf` after the move resolves; once every non-chief
// seat has flipped done, the engine transitions to `endOfRound`.
//
// Stage-gated to `scienceTurn` so a seat that is mid-`playingEvent`
// can't accidentally end its turn while the prior stage is parked on
// `_stageStack`. The seat must finish or cancel the event interrupt
// first (which pops back to `scienceTurn`), then call this.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const scienceSeatDone: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  clearUndoable(G);
  if (!G.othersDone) G.othersDone = {};
  G.othersDone[playerID] = true;
};
