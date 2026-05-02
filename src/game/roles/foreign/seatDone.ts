// foreignSeatDone (14.2) — the Foreign seat declares its turn finished.
//
// Flips `G.othersDone[playerID] = true`. bgio re-evaluates
// `othersPhase.endIf` after the move resolves; once every non-chief
// seat has flipped done, the engine transitions to `endOfRound`.
//
// Allowed from either `foreignTurn` or `foreignAwaitingDamage`. The
// latter is the interrupt stage `foreignFlipBattle` pushes the seat
// into; if a battle resolved badly enough that the resolver auto-
// pops the seat back, that path lives in the resolver itself. Until
// then, surfacing "End my turn" from the awaiting-damage stage gives
// the player an explicit way out (the in-flight battle stays in
// `foreign.inFlight.battle` for the resolver to clean up at end-of-
// round).
//
// Upkeep gate: if there are upkeep-eligible units in play and `_upkeepPaid`
// is false, the seat must either pay upkeep or release units down to zero
// before ending the turn. Units recruited this turn are exempt (see
// `upkeepableUnits` in upkeep.ts) so a seat that bought their first unit
// can end the turn without paying. There is no skip-with-penalty path.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { upkeepableUnits } from './upkeep.ts';
import { clearUndoable } from '../../undo.ts';

export const foreignSeatDone: Move<SettlementState> = ({
  G,
  ctx,
  playerID,
}) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  const stage = ctx.activePlayers?.[playerID];
  if (stage !== 'foreignTurn' && stage !== 'foreignAwaitingDamage') {
    return INVALID_MOVE;
  }

  const foreign = G.foreign;
  if (
    foreign !== undefined &&
    foreign._upkeepPaid !== true &&
    upkeepableUnits(G).length > 0
  ) {
    return INVALID_MOVE;
  }

  clearUndoable(G);
  if (!G.othersDone) G.othersDone = {};
  G.othersDone[playerID] = true;
};
