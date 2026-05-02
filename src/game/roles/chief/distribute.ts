// chiefDistribute (04.1) — the Chief moves resources between the bank and
// the chosen non-chief player's `in` slot on their player mat.
//
// Positive amounts push from bank → target.in (the original "deposit"
// behavior). Negative amounts pull back from target.in → bank, capped by
// what's currently sitting in `target.in`. The chief panel exposes both
// directions so a misclick is recoverable while the chief phase is still
// active. The seat's `in` bag is drained into their `stash` automatically
// when `othersPhase.turn.onBegin` runs (see phases/others.ts), so once
// chiefPhase ends pull-back is no longer reachable.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { PlayerID, SettlementState } from '../../types.ts';
import type { Resource, ResourceBag } from '../../resources/types.ts';
import { RESOURCES } from '../../resources/types.ts';
import { canAfford } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { appendBankLog, negateBag } from '../../resources/bankLog.ts';
import { rolesAtSeat } from '../../roles.ts';
import { clearUndoable } from '../../undo.ts';

export const chiefDistribute: Move<SettlementState> = (
  { G, ctx, playerID },
  targetSeat: PlayerID,
  amounts: Partial<ResourceBag>,
) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args
  // (not on `ctx`). Spectator / unauthenticated calls arrive as `undefined`.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the chief role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('chief')) {
    return INVALID_MOVE;
  }

  // Engine must be in chiefPhase.
  if (ctx.phase !== 'chiefPhase') return INVALID_MOVE;

  // No self-target — the chief seat owns no mat and self-distribution
  // would be meaningless under the design.
  if (targetSeat === playerID) return INVALID_MOVE;

  // Target must be a non-chief seat with a player mat.
  const targetMat = G.mats?.[targetSeat];
  if (targetMat === undefined) return INVALID_MOVE;

  // Validate amounts: must be a plain object of finite integers (any sign).
  if (typeof amounts !== 'object' || amounts === null) return INVALID_MOVE;
  for (const r of RESOURCES) {
    const v = amounts[r];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
      return INVALID_MOVE;
    }
  }

  // Split into push (bank → in) and pull (in → bank) bags.
  const push: Partial<ResourceBag> = {};
  const pull: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = amounts[r];
    if (v === undefined || v === 0) continue;
    if (v > 0) push[r] = v;
    else pull[r] = -v;
  }

  // Affordability checks up front so the mutation path can't half-apply.
  if (!canAfford(G.bank, push)) return INVALID_MOVE;
  if (!canAfford(targetMat.in, pull)) return INVALID_MOVE;

  if (Object.keys(push).length === 0 && Object.keys(pull).length === 0) {
    return;
  }

  // Distribution mutates the bank + the target seat's `in` bag, so the
  // pending undo's snapshot can no longer be cleanly restored.
  clearUndoable(G);

  if (Object.keys(push).length > 0) {
    transfer(G.bank, targetMat.in, push);
    appendBankLog(G, 'distribute', negateBag(push), `to seat ${targetSeat}`);
  }
  if (Object.keys(pull).length > 0) {
    transfer(targetMat.in, G.bank, pull);
    appendBankLog(G, 'distribute', pull, `pulled back from seat ${targetSeat}`);
  }
};
