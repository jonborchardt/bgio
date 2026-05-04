// Defense redesign 2.6 (D27) — `scienceDrill` move.
//
// The Science seat pays a small `science` cost from their stash and marks
// a chosen unit on the village grid with a one-shot `drillToken`. The
// resolver consumes the marker on the unit's next fire (+1 strength,
// applied last in the order — drill is *always* additive after every
// other modifier; see resolver.ts header).
//
// Validations (in order):
//   1. caller has a defined playerID and holds the `science` role,
//   2. caller is in stage `scienceTurn` (parallel-actives gate),
//   3. `G.science` exists and the per-round latch is unset,
//   4. unit lookup: `unitID` resolves to an entry in `G.defense.inPlay`,
//   5. seat's stash covers the science cost.
//
// Tuning lever: V1 ships at flat cost `1 science` from the stash. The
// helper below is the single source of truth — content / playtest can
// scale the cost (e.g. by `G.track.phaseIndex`) without touching the
// resolver.
//
// Round-end: the `science:reset-defense-moves` round-end hook (registered
// at module load) clears `scienceDrillUsed` / `scienceTaughtUsed` so the
// next round starts fresh. Drill markers themselves persist across rounds
// per spec — they're consumed at fire time, not by end-of-round cleanup.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { clearUndoable } from '../../undo.ts';
import { registerRoundEndHook } from '../../hooks.ts';

/**
 * Per-call drill cost. V1 returns a flat `{ science: 1 }` bag. Future
 * tuning can scale by `G.track?.phaseIndex` or similar — kept as a
 * helper so the call site stays linear.
 */
export const drillCost = (_G: SettlementState): { science: number } => ({
  science: 1,
});

export const scienceDrill: Move<SettlementState> = (
  { G, ctx, playerID },
  unitID: string,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  const science = G.science;
  if (science === undefined) return INVALID_MOVE;

  // Once-per-round latch.
  if (science.scienceDrillUsed === true) return INVALID_MOVE;

  if (typeof unitID !== 'string' || unitID.length === 0) {
    return INVALID_MOVE;
  }

  const defense = G.defense;
  if (defense === undefined) return INVALID_MOVE;
  const unit = defense.inPlay.find((u) => u.id === unitID);
  if (unit === undefined) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = drillCost(G);
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  // All gates passed — pay, mark, latch.
  clearUndoable(G);
  payFromStash(G, playerID, cost);
  unit.drillToken = true;
  science.scienceDrillUsed = true;
};

// Round-end hook: clear the per-round latches so the next round starts
// fresh. Registered at module load (idempotent — see `hooks.ts`'s
// registry contract). Drill markers themselves persist across rounds
// per spec; only the move-usage flags reset here.
registerRoundEndHook('science:reset-defense-moves', (G) => {
  if (G.science === undefined) return;
  G.science.scienceDrillUsed = false;
  G.science.scienceTaughtUsed = false;
});
