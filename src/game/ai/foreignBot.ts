// 11.6 — ForeignBot.
//
// Pure heuristic for the Foreign role:
//   1. If the seat is in `foreignAwaitingDamage`, build a single
//      damage-allocation plan that absorbs the full incoming damage
//      with the lowest-HP committed unit and call
//      `foreignAssignDamage`.
//   2. If not in `foreignTurn`, return null.
//   3. Pay upkeep first if it hasn't been paid this stage. If the
//      stash can't cover the bill, release the cheapest in-play unit
//      until upkeep fits.
//   4. Recruit the cheapest hand unit while the stash can afford it.
//   5. If the battle deck is non-empty AND the last battle wasn't a
//      loss, simulate the next battle via `resolveBattle` with the
//      "lowest HP first" allocation plan; if predicted win, flip.
//   6. After a winning battle, flip a trade card while the trade
//      deck is non-empty.
//   7. Otherwise: null.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import { canAfford } from '../resources/bag.ts';
import { UNITS } from '../../data/index.ts';
import type { UnitInstance } from '../roles/foreign/types.ts';
import {
  resolveBattle,
  type DamageAllocation,
  type EnemyDamageRule,
} from '../roles/foreign/battleResolver.ts';
import type { MoveCandidate } from './enumerate.ts';

export type BotAction = MoveCandidate;

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

const lookupUnit = (defID: string) => UNITS.find((u) => u.name === defID);

/**
 * Estimate per-unit upkeep cost. The actual move applies a Domestic
 * `unitMaintenance` modifier; we ignore that here for the bot's V1
 * heuristic — over-estimating upkeep just means the bot releases a
 * unit it could have kept, which is conservative.
 */
const upkeepBill = (G: SettlementState): number => {
  if (G.foreign === undefined) return 0;
  let total = 0;
  for (const entry of G.foreign.inPlay) {
    const def = lookupUnit(entry.defID);
    if (def === undefined) continue;
    total += def.cost * entry.count;
  }
  return total;
};

/**
 * Find the cheapest in-play unit's defID, for release-when-broke.
 * Returns null when there's nothing to release.
 */
const cheapestInPlay = (G: SettlementState): string | null => {
  if (G.foreign === undefined) return null;
  let best: { defID: string; cost: number } | null = null;
  // Iterate inPlay in order; tie-break by defID alphabetic for
  // determinism.
  const entries = [...G.foreign.inPlay].sort((a, b) =>
    a.defID.localeCompare(b.defID),
  );
  for (const entry of entries) {
    if (entry.count <= 0) continue;
    const def = lookupUnit(entry.defID);
    if (def === undefined) continue;
    if (best === null || def.cost < best.cost) {
      best = { defID: entry.defID, cost: def.cost };
    }
  }
  return best === null ? null : best.defID;
};

/**
 * Cheapest hand unit by cost, with name tie-break for determinism.
 */
const cheapestHand = (G: SettlementState) => {
  const foreign = G.foreign;
  if (foreign === undefined || foreign.hand.length === 0) return null;
  const sorted = [...foreign.hand].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.name.localeCompare(b.name);
  });
  return sorted[0]!;
};

/**
 * Build a "lowest HP first" damage allocation plan for the resolver.
 * The plan replicates one entry per enemy attack — we don't know the
 * resolver's micro-schedule up front so we synthesize a worst-case
 * plan: every committed unit's defense is total HP, and the lowest-HP
 * defID absorbs first.
 *
 * V1 simplification: produce a SINGLE allocation that puts all damage
 * onto the lowest-HP defID, sized to that unit's current HP pool.
 * The resolver may need additional allocations for follow-up rounds —
 * for the bot's predictive call we just send one and accept that
 * "lose" / "mid" outcomes signal "don't flip".
 */
const buildAllocationPlan = (
  committed: UnitInstance[],
): DamageAllocation[] => {
  // Pick lowest-HP defID (lowest defense per unit).
  let target: { defID: string; hp: number; count: number } | null = null;
  const sorted = [...committed].sort((a, b) =>
    a.defID.localeCompare(b.defID),
  );
  for (const entry of sorted) {
    if (entry.count <= 0) continue;
    const def = lookupUnit(entry.defID);
    if (def === undefined) continue;
    const hp = def.defense > 0 ? def.defense : 1;
    if (target === null || hp < target.hp) {
      target = { defID: entry.defID, hp, count: entry.count };
    }
  }
  if (target === null) return [];
  const totalHp = target.hp * target.count;
  // Single allocation: absorb up to totalHp on this defID.
  return [{ byUnit: { [target.defID]: totalHp } }];
};

/**
 * Predict whether the next battle would be a win. We run the resolver
 * with a synthesized allocation plan: every committed unit's full HP
 * goes onto the lowest-HP defID over multiple allocations of size 1 so
 * we cover up to N=20 enemy hits. If the resolver returns 'win' we
 * trust it; anything else (lose / mid / uncertain) → don't flip.
 *
 * The resolver re-validates allocations against live state so an
 * over-supply of plans is harmless: the resolver only consumes one
 * allocation per actual enemy hit. We pre-build enough to absorb a
 * worst-case engagement.
 */
const predictWin = (G: SettlementState): boolean => {
  const foreign = G.foreign;
  if (foreign === undefined || foreign.battleDeck.length === 0) return false;
  const nextBattle = foreign.battleDeck[0]!;
  const playerRoster: UnitInstance[] = foreign.inPlay.map((u) => ({ ...u }));
  if (playerRoster.length === 0) return false;
  const enemyRoster: UnitInstance[] = nextBattle.units.map((u) => ({
    defID: u.name,
    count: u.count ?? 1,
  }));
  const enemyDamageRule: EnemyDamageRule = 'attacksWeakest';

  // Pick the lowest-HP defID we'd absorb damage on.
  let absorber: { defID: string; perUnitHp: number; count: number } | null =
    null;
  const sortedRoster = [...playerRoster].sort((a, b) =>
    a.defID.localeCompare(b.defID),
  );
  for (const entry of sortedRoster) {
    const def = lookupUnit(entry.defID);
    if (def === undefined) continue;
    const hp = def.defense > 0 ? def.defense : 1;
    if (absorber === null || hp < absorber.perUnitHp) {
      absorber = { defID: entry.defID, perUnitHp: hp, count: entry.count };
    }
  }
  if (absorber === null) return false;

  // Build a generous bank of allocations. We don't know the exact
  // damage values so we provide one allocation per unit of HP (each
  // worth 1 incoming damage). The resolver consumes whichever it
  // needs.
  const totalHp = absorber.perUnitHp * absorber.count;
  // Provide a few extra entries so larger single hits (atk > 1)
  // collapse to one allocation each — but we don't know how the
  // resolver will split. Empirically, a plan that puts all damage on
  // one defID with the right size for the FIRST hit will succeed if
  // the enemy can only land one strike. For multi-strike enemies,
  // 'mid' is the result and we conservatively don't flip.
  const allocations: DamageAllocation[] = [];
  // Try a single big allocation first — many enemy cards have a
  // single weak unit that hits once.
  for (let i = 1; i <= totalHp && i <= 20; i++) {
    allocations.push({ byUnit: { [absorber.defID]: i } });
  }
  // The resolver only consumes one allocation per enemy hit; pre-
  // calculating which size matches each hit is intractable without
  // simulating the exact tick order. Pragmatic compromise: try the
  // single-largest plan first (covers all damage in one hit), then
  // fall back to a per-1-damage plan.
  const planSingle: DamageAllocation[] = [
    { byUnit: { [absorber.defID]: totalHp } },
  ];

  // Run two simulations: one with a single big allocation, one with
  // many small ones. If either predicts 'win', flip.
  for (const plan of [planSingle, allocations]) {
    const out = resolveBattle({
      player: playerRoster.map((u) => ({ ...u })),
      enemy: enemyRoster.map((u) => ({ ...u })),
      enemyDamageRule,
      damageAllocations: plan,
    });
    if (out.outcome === 'win') return true;
  }
  return false;
};

const playForeignAwaitingDamage = (state: BotState): BotAction | null => {
  const { G } = state;
  const foreign = G.foreign;
  if (foreign === undefined) return null;
  const battle = foreign.inFlight.battle;
  if (battle === null) return null;

  // Build a naive plan: lowest-HP committed unit eats the bulk of the
  // damage. The plan above maps a single defID to its full HP pool.
  const plan = buildAllocationPlan(foreign.inFlight.committed);
  return { move: 'foreignAssignDamage', args: [plan] };
};

const playForeignTurn = (state: BotState): BotAction | null => {
  const { G, playerID } = state;
  const foreign = G.foreign;
  if (foreign === undefined) return null;
  const stash = G.mats?.[playerID]?.stash;
  if (stash === undefined) return null;

  // Trade fulfillment is now chief-only (see tradeFulfill.ts) — the
  // foreign bot doesn't try to fulfill anymore. Foreign just keeps
  // flipping trade cards after wins to produce more requests for the
  // chief to resolve.

  // Step 1: upkeep, if not yet paid this stage.
  if (foreign._upkeepPaid !== true && !foreign.inFlight.battle) {
    const bill = upkeepBill(G);
    if (bill > 0 && !canAfford(stash, { gold: bill })) {
      // Stash can't cover — release the cheapest unit first.
      const releaseTarget = cheapestInPlay(G);
      if (releaseTarget !== null) {
        return {
          move: 'foreignReleaseUnit',
          args: [releaseTarget],
        };
      }
      // Nothing to release but we can't pay — fall through; the
      // upkeep move will just INVALID_MOVE if we tried, so we
      // return null and let the caller mark seat-done.
      return null;
    }
    return { move: 'foreignUpkeep', args: [] };
  }

  // Step 2: recruit cheapest affordable.
  const cheapest = cheapestHand(G);
  if (cheapest !== null && canAfford(stash, { gold: cheapest.cost })) {
    return { move: 'foreignRecruit', args: [cheapest.name, 1] };
  }

  // Step 3: flip a battle if we predict a win.
  if (
    foreign.battleDeck.length > 0 &&
    foreign.lastBattleOutcome !== 'lose' &&
    foreign.inFlight.battle === null
  ) {
    if (predictWin(G)) {
      return { move: 'foreignFlipBattle', args: [] };
    }
  }

  // Step 4: trade flip after a winning battle.
  if (
    foreign.lastBattleOutcome === 'win' &&
    foreign.tradeDeck.length > 0
  ) {
    return { move: 'foreignFlipTrade', args: [] };
  }

  return null;
};

const play = (state: BotState): BotAction | null => {
  const { ctx, playerID, G } = state;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return null;
  }
  const stage = ctx.activePlayers?.[playerID];
  if (stage === 'foreignAwaitingDamage') {
    return playForeignAwaitingDamage(state);
  }
  if (stage !== 'foreignTurn') return null;
  return playForeignTurn(state);
};

export const foreignBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
