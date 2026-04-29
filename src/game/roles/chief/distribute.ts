// chiefDistribute (04.1) — the Chief takes resources from the bank and drops
// them into the chosen non-chief player's circle on the center mat.
//
// This is the only chief-only resource move; all other roles draw from their
// own circles via `pullFromMat`. Permission gating is handled inline (caller
// must hold the `chief` role and the engine must be in `chiefPhase`); the
// affordability check delegates to `canAfford` so a failure is observable
// pre-mutation and we never half-apply a transfer under Immer.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { PlayerID, SettlementState } from '../../types.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { canAfford, findInvalidAmount } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { rolesAtSeat } from '../../roles.ts';

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

  // No self-target — the chief seat owns no circle and self-distribution
  // would be meaningless under the design.
  if (targetSeat === playerID) return INVALID_MOVE;

  // Target must be a non-chief seat with a circle on the mat.
  const circle = G.centerMat.circles[targetSeat];
  if (!circle) return INVALID_MOVE;

  // Reject negative / non-finite / non-integer amounts before any
  // affordability check (canAfford returns true for negatives —
  // `0 < -5` is false — which would let transfer mint resources).
  if (typeof amounts !== 'object' || amounts === null) return INVALID_MOVE;
  if (findInvalidAmount(amounts) !== null) return INVALID_MOVE;

  // Affordability check up front so the mutation path can't half-apply.
  if (!canAfford(G.bank, amounts)) return INVALID_MOVE;

  // All checks passed — move the tokens from the bank into the target's
  // circle. `transfer` re-checks affordability and mutates both bags
  // directly under Immer.
  transfer(G.bank, circle, amounts);
};
