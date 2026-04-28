// foreignRecruit (07.2) — the Foreign seat pays gold from their wallet to
// recruit a unit (or `count` copies of one) into `G.foreign.inPlay`.
//
// The cost is `def.cost * count` gold, reduced by any in-play Domestic
// buildings whose benefit string parses to a `unitCost` BenefitEffect (the
// canonical example is the Forge: "units cost 1 less"). Multiple Forges (or
// other unit-cost-modifying buildings) stack additively. The reduction is
// clamped at zero — a glut of Forges does not turn recruiting into a free
// transfer from the bank.
//
// Stage gating: the move requires the caller to hold `foreign` AND be in the
// `foreignTurn` stage so event-stage interrupts (which push `playingEvent`
// per 02.2) can't sneak through during the foreign seat's turn.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { UNITS, BUILDINGS } from '../../../data/index.ts';
import { payFromWallet } from '../../resources/moves.ts';
import { canAfford } from '../../resources/bag.ts';
import { parseBenefit } from '../domestic/parseBenefit.ts';

/**
 * Sum of every `unitCost` BenefitEffect across in-play Domestic buildings.
 * Negative values reduce the cost (Forge: -1); positive values would
 * increase it. Returns 0 when Domestic state is missing or no matching
 * buildings have been placed.
 */
const sumUnitCostModifier = (G: SettlementState): number => {
  if (G.domestic === undefined) return 0;
  let total = 0;
  for (const placed of Object.values(G.domestic.grid)) {
    const def = BUILDINGS.find((b) => b.name === placed.defID);
    if (def === undefined) continue;
    if (def.benefit === '') continue;
    let parsed;
    try {
      parsed = parseBenefit(def.benefit);
    } catch {
      // Defensive: a building whose benefit string doesn't parse shouldn't
      // crash the recruit move. The parser already throws loudly on
      // module-load drift via the test suite, so reaching this branch in
      // practice means a hand-built fixture with an unparseable benefit.
      continue;
    }
    for (const effect of parsed.effects) {
      if (effect.kind === 'unitCost') total += effect.amount;
    }
  }
  return total;
};

export const foreignRecruit: Move<SettlementState> = (
  { G, ctx, playerID },
  defID: string,
  count?: number,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'foreignTurn') return INVALID_MOVE;

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return INVALID_MOVE;

  const n = count ?? 1;
  if (!Number.isInteger(n) || n < 1) return INVALID_MOVE;

  // Base gold cost, reduced by the sum of Domestic `unitCost` modifiers
  // (Forge: -1). Per-unit reduction stacks additively across `n` units —
  // matches the boardgame intuition that each unit benefits from the
  // discount, not just the batch.
  const modifier = sumUnitCostModifier(G);
  const perUnitCost = Math.max(0, def.cost + modifier);
  const adjustedCost = perUnitCost * n;

  const wallet = G.wallets[playerID];
  if (!wallet) return INVALID_MOVE;
  const cost = { gold: adjustedCost };
  if (!canAfford(wallet, cost)) return INVALID_MOVE;

  payFromWallet(G, playerID, cost);

  // Increment existing entry or append a new one — the invariant is that no
  // two entries in `inPlay` share a `defID`.
  const existing = foreign.inPlay.find((u) => u.defID === defID);
  if (existing !== undefined) {
    existing.count += n;
  } else {
    foreign.inPlay.push({ defID, count: n });
  }
};
