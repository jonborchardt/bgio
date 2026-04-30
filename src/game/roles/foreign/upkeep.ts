// foreignUpkeep (07.2) — pay maintenance gold for every unit in
// `G.foreign.inPlay` at the start of the Foreign seat's stage.
//
// V1 stub maintenance: per-unit `def.cost` (one cost = one upkeep). Reduced
// by the sum of Domestic `unitMaintenance` BenefitEffects (Walls: -2,
// Tower: -4). Negative effect amounts mean "decreases upkeep"; the parser
// already encodes the sign.
//
// Units recruited during the current foreign turn are exempt from upkeep
// this round — they "joined too late to draw a paycheck." The exemption is
// tracked in `foreign._recruitedThisTurn` (set by `foreignRecruit`, cleared
// by the foreign:reset-upkeep hook at endOfRound). We clamp the exemption
// per-defID at `inPlay.count` so a release after a recruit can't produce
// a negative count.
//
// We require enough stash gold to cover the full bill — partial payment is
// not allowed. If the stash underflows the move returns INVALID_MOVE; the
// player must first call `foreignReleaseUnit` to refund half-cost on units
// they can't afford to keep. This matches the 07.2 plan's V1 contract.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { UNITS, BUILDINGS } from '../../../data/index.ts';
import { payFromStash } from '../../resources/moves.ts';
import { canAfford } from '../../resources/bag.ts';
import { parseBenefit } from '../domestic/parseBenefit.ts';
import { registerRoundEndHook } from '../../hooks.ts';

// foreign:reset-upkeep — at endOfRound we clear `_upkeepPaid` so the
// Foreign seat can pay upkeep again next round. Without this, after
// round 1 the seat is permanently exempt from upkeep (a soft-lock
// since the stage's "must call upkeep first" contract evaporates).
// We also clear `_recruitedThisTurn` so this-turn-recruit exemptions
// expire — units recruited last round must be paid for next round.
registerRoundEndHook('foreign:reset-upkeep', (G) => {
  if (G.foreign === undefined) return;
  if (G.foreign._upkeepPaid === true) G.foreign._upkeepPaid = false;
  if (G.foreign._recruitedThisTurn !== undefined) {
    G.foreign._recruitedThisTurn = {};
  }
});

/**
 * Effective per-defID unit count subject to upkeep right now: `inPlay.count`
 * minus the count recruited this turn (clamped to `inPlay.count` so a
 * release after a recruit can never produce a negative). Returned as an
 * array of `{ defID, count }` so callers can drive both the bill and the
 * "anything-still-owed" gate off one source.
 */
export const upkeepableUnits = (
  G: SettlementState,
): Array<{ defID: string; count: number }> => {
  const out: Array<{ defID: string; count: number }> = [];
  const foreign = G.foreign;
  if (foreign === undefined) return out;
  const recruited = foreign._recruitedThisTurn ?? {};
  for (const entry of foreign.inPlay) {
    const exempt = Math.min(recruited[entry.defID] ?? 0, entry.count);
    const remaining = entry.count - exempt;
    if (remaining > 0) out.push({ defID: entry.defID, count: remaining });
  }
  return out;
};

/**
 * Sum of every `unitMaintenance` BenefitEffect across in-play Domestic
 * buildings. Negative values reduce upkeep (Walls: -2, Tower: -4). Returns
 * 0 when Domestic state is missing.
 */
export const sumUnitMaintenanceModifier = (G: SettlementState): number => {
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

/**
 * Total gold the Foreign seat owes in upkeep right now. Mirrors the cost
 * computed inside `foreignUpkeep` so the panel can preview / gate the move.
 * Excludes units recruited this turn (see `upkeepableUnits`). Returns 0
 * when foreign state is missing or no units are in play.
 */
export const computeForeignUpkeepGold = (G: SettlementState): number => {
  if (G.foreign === undefined) return 0;
  const modifier = sumUnitMaintenanceModifier(G);
  let total = 0;
  for (const entry of upkeepableUnits(G)) {
    const def = UNITS.find((u) => u.name === entry.defID);
    if (def === undefined) continue;
    const perUnit = Math.max(0, def.cost + modifier);
    total += perUnit * entry.count;
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
  const totalGold = computeForeignUpkeepGold(G);

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = { gold: totalGold };
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  if (totalGold > 0) payFromStash(G, playerID, cost);
  foreign._upkeepPaid = true;
  foreign._lastRelease = undefined;
};
