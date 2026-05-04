// Domestic produce: sums parsed `BuildingDef.benefit` yields across every
// placed building (worker token doubles a cell's contribution), then layers
// in the adjacency bonus and deposits the bag into the Domestic seat's
// `out` slot. The chief sweeps `out` into `G.bank` on the next chief turn,
// so the bank sees production after a turn delay — matching the physical
// board flow.
//
// Auto-fire: `runProduceForSeat` runs at `othersPhase.turn.onBegin` for
// every seat that holds the domestic role (see `phases/others.ts`), so
// produce is no longer a player-driven decision. The `domesticProduce`
// move is kept as a callable surface (for tests / future scripted flows),
// but in normal play the latch is already set by the time the seat enters
// `domesticTurn`.
//
// `parsed.effects` are intentionally not applied here — they affect other
// moves (Foreign upkeep / recruit, combat, happiness).
//
// Idempotency: `producedThisRound` on `DomesticState`, cleared at
// endOfRound by the `domestic:reset-produced` hook registered below.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { BUILDINGS } from '../../../data/index.ts';
import { add } from '../../resources/bag.ts';
import { EMPTY_BAG, RESOURCES } from '../../resources/types.ts';
import type { Resource, ResourceBag } from '../../resources/types.ts';
import { registerRoundEndHook } from '../../hooks.ts';
import { placeIntoOut } from '../../resources/playerMat.ts';
import { parseBenefit, type BenefitYield } from './parseBenefit.ts';
import { adjacencyRules, yieldAdjacencyBonus } from './adjacency.ts';

/**
 * Defense redesign D16 — prorates a parsed building's yield bag by its
 * current HP / maxHp. The **loss** side rounds up: `yieldLost = ceil(raw *
 * damagePct)`, with `damagePct = (maxHp - hp) / maxHp`. Effective yield
 * per resource is `max(0, raw - yieldLost)`. The ceiling-on-loss reading
 * (vs. floor-on-keep) is intentional: it ensures even 1 HP off a 4-yield
 * building shaves 1 from the yield, where the floor-on-keep alternative
 * would silently round small damage to nothing.
 *
 * `maxHp <= 0` is defensive: shouldn't happen in practice, but if it
 * did the math would NaN — clamping to "no damage" keeps the bag valid.
 */
const prorateResources = (
  raw: Partial<ResourceBag>,
  hp: number,
  maxHp: number,
): Partial<ResourceBag> => {
  if (maxHp <= 0 || hp >= maxHp) return raw;
  const damagePct = (maxHp - hp) / maxHp;
  const out: Partial<ResourceBag> = {};
  for (const r of RESOURCES) {
    const v = raw[r as Resource];
    if (v === undefined || v === 0) continue;
    const lost = Math.ceil(v * damagePct);
    const kept = Math.max(0, v - lost);
    if (kept > 0) out[r as Resource] = kept;
  }
  return out;
};

/**
 * Pure produce step: sums building yields (with worker doubling and
 * adjacency bonus) and deposits the bag into the seat's `out` slot, then
 * sets the per-round latch. No gating — callers must ensure the seat
 * actually holds the domestic role and hasn't already produced this round.
 *
 * Returns `true` on a successful produce, `false` when the state is
 * malformed (no `G.domestic`, no seat mat) or the latch was already set.
 */
export const runProduceForSeat = (
  G: SettlementState,
  playerID: string,
): boolean => {
  const domestic = G.domestic;
  if (domestic === undefined) return false;
  if (domestic.producedThisRound === true) return false;

  const seatMat = G.mats?.[playerID];
  if (seatMat === undefined) return false;

  const parseCache = new Map<string, BenefitYield>();
  let runningYield: ResourceBag = { ...EMPTY_BAG };

  for (const placed of Object.values(domestic.grid)) {
    // Defense redesign D2 — skip the synthetic center tile. It is a
    // coordinate anchor, not a producing building; it has no `BuildingDef`
    // entry and contributes zero yield. The check is explicit rather than
    // relying on the `BUILDINGS.find` miss below so the intent is local.
    if (placed.isCenter === true) continue;
    const def = BUILDINGS.find((b) => b.name === placed.defID);
    if (def === undefined) continue;

    let parsed = parseCache.get(placed.defID);
    if (parsed === undefined) {
      parsed = parseBenefit(def.benefit);
      parseCache.set(placed.defID, parsed);
    }

    // Defense redesign D16 — prorate this cell's yield by the building's
    // current damage. `damagePct = (maxHp - hp) / maxHp`, and the **loss**
    // side rounds up: `yieldLost = ceil(rawYield * damagePct)`. Even one
    // HP missing visibly bites (a 4-yield Mill at HP-3-of-4 produces 3,
    // not 4). Worker doubling is applied to the prorated yield so a
    // damaged building stays damaged regardless of whether it's worker-
    // boosted that round.
    const proratedResources = prorateResources(
      parsed.resources,
      placed.hp,
      placed.maxHp,
    );
    runningYield = add(runningYield, proratedResources);
    if (placed.worker !== null) {
      runningYield = add(runningYield, proratedResources);
    }
  }

  runningYield = add(runningYield, yieldAdjacencyBonus(domestic.grid, adjacencyRules));

  placeIntoOut(seatMat, runningYield);
  domestic.producedThisRound = true;
  return true;
};

export const domesticProduce: Move<SettlementState> = ({ G, ctx, playerID }) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  if (!runProduceForSeat(G, playerID)) return INVALID_MOVE;
};

// Round-end hook: clear the per-round produce latch so next round's
// `domesticProduce` can fire again. Registered at module load (idempotent —
// see 02.5 hooks registry contract). Tests that need a clean slate must
// call `__resetHooksForTest()` and then re-import this module.
//
// Lazy init: if `G.domestic` exists but `producedThisRound` was never set
// (fresh setup, never called produce), reading it is `undefined` and we
// can leave it unset; explicitly writing `false` keeps the flag stable for
// any consumer that relies on the "after a round, the flag is false"
// shape.
registerRoundEndHook('domestic:reset-produced', (G) => {
  if (G.domestic === undefined) return;
  G.domestic.producedThisRound = false;
});
