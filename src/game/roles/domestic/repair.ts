// domesticRepair (Defense redesign 1.3, D17) — the Domestic seat spends
// stash gold to restore HP on one of their placed buildings.
//
// Rules (spec D17):
//   - Target cell must exist on the grid, must NOT be the center tile, and
//     must be below maxHp.
//   - Repair amount is clamped to `maxHp - hp` (so a player can pass a
//     generous `amount` and only pay for what fits).
//   - Cost: `ceil(def.cost * wantedAmount / maxHp)` from stash. Currency
//     is gold by default — matching how `domesticUpgradeBuilding` works
//     today. Non-gold repair costs are deferred to balance tuning in
//     Phase 2 / playtest (per the sub-phase plan).
//
// Stage gating mirrors `domesticBuyBuilding`: the caller must hold the
// domestic role AND be in stage `domesticTurn` so an event-stage
// interrupt can't sneak through during the seat's turn.
//
// This move is the only player-driven HP restoration surface in 1.3 —
// damage generation lands in Phase 2 alongside the track resolver, so
// today the move is verifiable but the world has no way to chip HP
// down except through tests setting `cell.hp` directly.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { BUILDINGS } from '../../../data/index.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { cellKey } from './grid.ts';
import { clearUndoable } from '../../undo.ts';

export const domesticRepair: Move<SettlementState> = (
  { G, ctx, playerID },
  x: number,
  y: number,
  amount: number,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  const domestic = G.domestic;
  if (domestic === undefined) return INVALID_MOVE;

  // Validate the requested amount up front. Negative / NaN / zero are all
  // "nothing to do" — reject them so a network-supplied junk value can't
  // mint HP for free or trigger a 0-cost upgrade-counter bump style bug.
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return INVALID_MOVE;
  }

  const key = cellKey(x, y);
  const cell = domestic.grid[key];
  if (cell === undefined) return INVALID_MOVE;
  // Defense redesign D2 — the center tile is a coordinate anchor, not a
  // building. It is not repairable (and never takes damage in the first
  // place; combat skips it).
  if (cell.isCenter === true) return INVALID_MOVE;

  const missing = cell.maxHp - cell.hp;
  if (missing <= 0) return INVALID_MOVE;

  // Clamp the wanted amount to the missing HP so a generous request only
  // pays for what fits. The cost scales with the clamped amount.
  const wantedAmount = Math.min(amount, missing);

  const def = BUILDINGS.find((b) => b.name === cell.defID);
  if (def === undefined) return INVALID_MOVE;

  // Cost: ceil(def.cost * wantedAmount / maxHp). Gold-only by default;
  // non-gold repair costs are deferred to balance tuning. The ceiling
  // mirrors the produce-side ceiling on yield loss — it's cheaper to
  // repair when the building is small relative to its cost, but never
  // free.
  const cost = { gold: Math.ceil((def.cost * wantedAmount) / cell.maxHp) };

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  // All gates passed — clear any pending undo, pay the bank, restore HP.
  // We use clearUndoable rather than markUndoable: repair is committed,
  // not a "play card" action that should pop back via undoLast.
  clearUndoable(G);
  payFromStash(G, playerID, cost);
  cell.hp += wantedAmount;
};
