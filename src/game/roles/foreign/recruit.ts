// foreignRecruit (07.2) — the Foreign seat pays from their stash to
// recruit a unit (or `count` copies of one) into `G.foreign.inPlay`.
//
// The base cost comes from `unitCost(def)` (gold-only when `def.costBag`
// is absent, full bag when present), scaled by `count`. The Domestic
// `unitCost` modifier (Forge: "units cost 1 less") subtracts from the
// **gold portion only** — non-gold inputs (steel, wood, food, ...) are
// not discountable, since the Forge fiction is "the smithy makes gold-
// equivalents go further" and not "the smithy invents iron." Multiple
// Forges stack additively. The gold reduction is clamped at zero — a
// glut of Forges does not turn recruiting into a free transfer from
// the bank.
//
// Stage gating: the move requires the caller to hold `foreign` AND be in the
// `foreignTurn` stage so event-stage interrupts (which push `playingEvent`
// per 02.2) can't sneak through during the foreign seat's turn.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { UNITS, BUILDINGS } from '../../../data/index.ts';
import type { UnitDef } from '../../../data/index.ts';
import { payFromStash } from '../../resources/moves.ts';
import { canAfford } from '../../resources/bag.ts';
import { RESOURCES } from '../../resources/types.ts';
import type { Resource, ResourceBag } from '../../resources/types.ts';
import { parseBenefit } from '../domestic/parseBenefit.ts';

/**
 * Sum of every `unitCost` BenefitEffect across in-play Domestic buildings.
 * Negative values reduce the cost (Forge: -1); positive values would
 * increase it. Returns 0 when Domestic state is missing or no matching
 * buildings have been placed.
 */
export const sumUnitCostModifier = (G: SettlementState): number => {
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

/**
 * Pure helper: apply the Domestic `unitCost` modifier (Forge: -1 gold)
 * to a UnitDef's base cost bag. Exposed for direct unit-testing without
 * threading a full SettlementState fixture.
 *
 * Multi-resource units carry a `costBag`; the modifier only adjusts the
 * gold portion (clamped at zero). Single-resource units fall back to
 * `{ gold: def.cost }`.
 */
export const applyUnitCostModifier = (
  def: Pick<UnitDef, 'cost' | 'costBag'>,
  modifier: number,
): Partial<ResourceBag> => {
  const base = def.costBag ?? { gold: def.cost };
  if (modifier === 0) return { ...base };
  // Forge-style discount: subtract from gold only, clamp at zero.
  const out: Partial<ResourceBag> = { ...base };
  const goldBase = out.gold ?? 0;
  out.gold = Math.max(0, goldBase + modifier);
  return out;
};

/**
 * Per-unit cost bag to recruit `defID` right now, after the Domestic
 * `unitCost` modifier. Returns an empty bag if the unit isn't in
 * `UNITS`, matching the move's INVALID_MOVE path so panels don't paint
 * a phantom "free" button.
 */
export const computeUnitRecruitCostBag = (
  G: SettlementState,
  defID: string,
): Partial<ResourceBag> => {
  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return {};
  return applyUnitCostModifier(def, sumUnitCostModifier(G));
};

/**
 * Backwards-compat shim: returns the **gold portion** of the per-unit
 * recruit cost. Existing UI / AI call sites that only know about a scalar
 * gold cost continue to work; new call sites should prefer
 * `computeUnitRecruitCostBag` so they can paint multi-resource costs.
 */
export const computeUnitRecruitCost = (G: SettlementState, defID: string): number => {
  return computeUnitRecruitCostBag(G, defID).gold ?? 0;
};

/**
 * Multiply a (small) cost bag by a positive integer. Local helper so the
 * recruit move can scale the per-unit bag by `count` without leaking a
 * `multiply` primitive into the resource module.
 */
const scaleBag = (
  bag: Partial<ResourceBag>,
  n: number,
): Partial<ResourceBag> => {
  const out: Partial<ResourceBag> = {};
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = bag[r];
    if (v !== undefined && v !== 0) out[r] = v * n;
  }
  return out;
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

  // Per-unit cost bag (multi-resource when the def carries a costBag),
  // already discounted by the Domestic `unitCost` modifier on its gold
  // portion. Scale by `n` so each unit benefits from the discount, not
  // just the batch.
  const perUnit = computeUnitRecruitCostBag(G, defID);
  const cost = scaleBag(perUnit, n);

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  payFromStash(G, playerID, cost);

  // Increment existing entry or append a new one — the invariant is that no
  // two entries in `inPlay` share a `defID`.
  const existing = foreign.inPlay.find((u) => u.defID === defID);
  if (existing !== undefined) {
    existing.count += n;
  } else {
    foreign.inPlay.push({ defID, count: n });
  }

  // Tag this batch as recruited-this-turn so it's exempt from upkeep until
  // next round. Cleared at endOfRound by the foreign:reset-upkeep hook.
  if (foreign._recruitedThisTurn === undefined) {
    foreign._recruitedThisTurn = {};
  }
  foreign._recruitedThisTurn[defID] =
    (foreign._recruitedThisTurn[defID] ?? 0) + n;

  foreign._lastRelease = undefined;
};
