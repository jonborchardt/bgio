// Science Library SL 3.2 — `scienceLibraryBurn(slotIndex)` move.
//
// Fires during the science seat's `scienceTurn` stage. Pushes the
// slot's card into `G.library.lostIdeas` (gone forever) and nulls
// the slot. No payment, no discount-tableau update, no recipient
// handoff. Burn is free in resources; expensive in opportunity cost.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';
import { registerRoundEndHook } from '../../hooks.ts';

export const scienceLibraryBurn: Move<SettlementState> = (
  { G, ctx, playerID },
  slotIndex: number,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  const lib = G.library;
  if (lib === undefined) return INVALID_MOVE;

  if (
    typeof slotIndex !== 'number' ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= lib.row.length
  ) {
    return INVALID_MOVE;
  }
  const card = lib.row[slotIndex];
  if (card === null || card === undefined) return INVALID_MOVE;

  clearUndoable(G);
  lib.lostIdeas.push(card);
  lib.row[slotIndex] = null;
  if (G.science !== undefined) {
    G.science.scienceBurnedThisRound = true;
  }
};

registerRoundEndHook('science:reset-burned-this-round', (G) => {
  if (G.science === undefined) return;
  G.science.scienceBurnedThisRound = false;
});
