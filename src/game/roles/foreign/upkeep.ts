// foreignUpkeep (07.2) — pay maintenance gold for every unit in
// `G.foreign.inPlay` at the start of the Foreign seat's stage.
//
// V1 stub maintenance: per-unit `def.cost` (one cost = one upkeep). Reduced
// by the sum of Domestic `unitMaintenance` BenefitEffects (Walls: -2,
// Tower: -4). Negative effect amounts mean "decreases upkeep"; the parser
// already encodes the sign.
//
// We require enough wallet gold to cover the full bill — partial payment is
// not allowed. If the wallet underflows the move returns INVALID_MOVE; the
// player must first call `foreignReleaseUnit` to refund half-cost on units
// they can't afford to keep. This matches the 07.2 plan's V1 contract.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { UNITS, BUILDINGS } from '../../../data/index.ts';
import { payFromWallet } from '../../resources/moves.ts';
import { canAfford } from '../../resources/bag.ts';
import { parseBenefit } from '../domestic/parseBenefit.ts';

/**
 * Sum of every `unitMaintenance` BenefitEffect across in-play Domestic
 * buildings. Negative values reduce upkeep (Walls: -2, Tower: -4). Returns
 * 0 when Domestic state is missing.
 */
const sumUnitMaintenanceModifier = (G: SettlementState): number => {
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
      continue;
    }
    for (const effect of parsed.effects) {
      if (effect.kind === 'unitMaintenance') total += effect.amount;
    }
  }
  return total;
};

export const foreignUpkeep: Move<SettlementState> = ({ G, ctx, playerID }) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'foreignTurn') return INVALID_MOVE;

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  // Idempotency: only one upkeep payment per `foreignTurn` stage. The flag
  // is cleared by the stage-entry plumbing on the next pass (07.x); for
  // V1 we just trust setup / 02.2 to keep it consistent.
  if (foreign._upkeepPaid === true) return INVALID_MOVE;

  // Per-unit maintenance is `def.cost` (V1 stub). Sum across every entry's
  // count, then apply the Domestic modifier additively per unit so a Wall
  // (-2) reduces every standing unit's upkeep by 2 — clamped at 0 so a
  // pile of Walls doesn't turn upkeep into a payout.
  const modifier = sumUnitMaintenanceModifier(G);
  let totalGold = 0;
  for (const entry of foreign.inPlay) {
    const def = UNITS.find((u) => u.name === entry.defID);
    if (def === undefined) continue;
    const perUnit = Math.max(0, def.cost + modifier);
    totalGold += perUnit * entry.count;
  }

  const wallet = G.wallets[playerID];
  if (!wallet) return INVALID_MOVE;
  const cost = { gold: totalGold };
  if (!canAfford(wallet, cost)) return INVALID_MOVE;

  if (totalGold > 0) payFromWallet(G, playerID, cost);
  foreign._upkeepPaid = true;
};
