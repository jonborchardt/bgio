// chiefEndPhase (04.2) — the Chief explicitly ends their phase.
//
// Flips `G.phaseDone = true`. bgio re-evaluates `chiefPhase.endIf` after the
// move resolves and transitions to `othersPhase`; that phase's `turn.onBegin`
// then activates every non-chief seat in their respective stage and parks
// the chief seat in `done` (see `activePlayersForOthers` in 02.2).
//
// Note on the flag namespace: the parent plan suggested `_phaseDone.chief`
// but 02.1 already shipped a top-level `phaseDone` flag and a matching
// `__testSetPhaseDone` test move + tests; we keep the simpler top-level
// flag for consistency with the existing wiring.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const chiefEndPhase: Move<SettlementState> = ({ G, ctx, playerID }) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the chief role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  // Only valid during chiefPhase. Calling this from othersPhase / endOfRound
  // (or any future phase) is a no-op-rejection rather than silently flipping
  // a flag the next chiefPhase would inherit.
  if (ctx.phase !== 'chiefPhase') return INVALID_MOVE;

  // Defense redesign 2.3 (D22): the chief must visibly flip the round's
  // track card before transitioning to othersPhase. Reject end-of-phase
  // until `chiefFlipTrack` has set the per-round latch. The track slot
  // is optional on G (older fixtures may pre-date 2.2), so we only
  // enforce the gate when `track` exists — tests that build a state
  // without a track should still be able to drive end-phase.
  if (G.track !== undefined && G.track.flippedThisRound !== true) {
    return INVALID_MOVE;
  }

  clearUndoable(G);
  G.phaseDone = true;
};
