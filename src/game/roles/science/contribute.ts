// scienceContribute (05.2) — the Science role pays resources from their
// stash toward a science card on the grid. Per game-design.md §Science,
// progress is tracked per card via the `paid` ledger and a card may not be
// advanced until every lower-level card in the same color column is
// completed (the "lowest-first" rule).
//
// This move is partial-credit by design: the Science seat may dribble
// resources onto a card across multiple turns. Completion (when paid covers
// cost) is a separate move — `scienceComplete` (05.3).

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { RESOURCES } from '../../resources/types.ts';
import { canAfford, findInvalidAmount } from '../../resources/bag.ts';
import { transfer } from '../../resources/bank.ts';
import { rolesAtSeat } from '../../roles.ts';

export const scienceContribute: Move<SettlementState> = (
  { G, ctx, playerID },
  cardID: string,
  amounts: Partial<ResourceBag>,
) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the science role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }

  // The Science seat acts only inside the `scienceTurn` stage of
  // `othersPhase`. We check stage explicitly rather than phase so
  // event-stage interrupts (which push `playingEvent` per 02.2) can't
  // sneak through during the Science seat's turn.
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  // Science state must be present (it always is post-05.1, but guard for
  // legacy fixtures so we never crash on an absent slice).
  const science = G.science;
  if (science === undefined) return INVALID_MOVE;

  // Locate the card on the flattened grid. The grid is small (3×3) so a
  // linear scan is fine — and clearer than threading column/row through.
  const card = science.grid.flat().find((c) => c.id === cardID);
  if (card === undefined) return INVALID_MOVE;

  // Already-completed cards are inert.
  if (science.completed.includes(cardID)) return INVALID_MOVE;

  // Lowest-first rule: among cards in the same color column that are not
  // yet completed, the lowest `level` is the only one that may receive
  // contributions. Scan only the matching column, since `grid` keeps each
  // column homogeneous in color (see 05.1 setup).
  const sameColorColumn = science.grid.find(
    (col) => col.length > 0 && col[0]!.color === card.color,
  );
  if (sameColorColumn === undefined) return INVALID_MOVE;
  let lowestLevel = Number.POSITIVE_INFINITY;
  for (const c of sameColorColumn) {
    if (science.completed.includes(c.id)) continue;
    if (c.level < lowestLevel) lowestLevel = c.level;
  }
  if (card.level !== lowestLevel) return INVALID_MOVE;

  // Reject negative / non-finite / non-integer amounts before any
  // affordability check.
  if (typeof amounts !== 'object' || amounts === null) return INVALID_MOVE;
  if (findInvalidAmount(amounts) !== null) return INVALID_MOVE;

  // Stash must cover the requested amounts.
  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  if (!canAfford(mat.stash, amounts)) return INVALID_MOVE;

  // Cap each resource at the remaining cost. The plan calls this defensive
  // — a polite UI shouldn't request more than `remaining`, but if it does
  // we silently round down to `remaining` so the paid ledger never exceeds
  // the cost. The leftover stays in the stash (no transfer).
  const paid = science.paid[cardID]!;
  const capped: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    const requested = amounts[r] ?? 0;
    if (requested === 0) continue;
    const need = (card.cost[r] ?? 0) - paid[r];
    if (need <= 0) continue;
    capped[r] = Math.min(requested, need);
  }

  // Move the capped tokens from stash → paid ledger. `transfer` re-checks
  // affordability and mutates both bags directly under Immer.
  transfer(mat.stash, paid, capped);
};
