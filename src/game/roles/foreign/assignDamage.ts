// 07.4 — `foreignAssignDamage` move.
//
// Run after `foreignFlipBattle` has dropped a card into
// `G.foreign.inFlight`. The caller passes the full damage-allocation plan
// in a single move (V1 simplification — the plan calls out multi-step
// negotiation as out-of-scope). We hand the plan to the pure
// `resolveBattle` resolver from 07.3, then apply the outcome:
//
//   * 'win'  — credit `card.reward` to the bank, increment
//              `G.settlementsJoined` if the card "joins" (V1: every battle
//              counts as joining 1 settlement on win unless the card
//              opted out via a `joins:false` field, which today is never
//              set in the JSON), collapse `inFlight.committed` back into
//              `G.foreign.inPlay`, and return the seat to `foreignTurn`.
//   * 'lose' — schedule `card.failure.tribute` on
//              `G.foreign.pendingTribute`, mark this seat done in
//              `G.othersDone`, and return the seat to `done`.
//   * 'mid'  — INVALID_MOVE; the allocation plan didn't terminate the
//              fight either way. State is left untouched (Immer rolls the
//              draft back when we return INVALID_MOVE).
//
// Validation errors from the resolver also collapse to INVALID_MOVE — see
// the 07.3 resolver for the catalog.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { STAGES } from '../../phases/stages.ts';
import type { StageEvents } from '../../phases/stages.ts';
import { resolveBattle } from './battleResolver.ts';
import type {
  DamageAllocation,
  EnemyDamageRule,
} from './battleResolver.ts';
import type { UnitInstance } from './types.ts';
import { RESOURCES } from '../../resources/types.ts';
import type { Resource, ResourceBag } from '../../resources/types.ts';
import { appendBankLog } from '../../resources/bankLog.ts';
import { UNITS } from '../../../data/index.ts';

/**
 * Translate a battle card's `units` array (with optional `count`) into the
 * `UnitInstance[]` shape the resolver consumes. Unknown unit names are
 * passed through — the resolver flags them via `validationErrors` so we
 * collapse to INVALID_MOVE rather than silently drop them.
 */
const enemyFromCard = (
  units: ReadonlyArray<{ name: string; count?: number }>,
): UnitInstance[] =>
  units.map((u) => ({
    defID: u.name,
    count: u.count ?? 1,
  }));

/**
 * Whether the given unit name resolves against the bundled UNITS table.
 * Used as a pre-flight validity check so a bad battle card surfaces
 * INVALID_MOVE instead of leaking a `validationErrors` string out of the
 * resolver.
 */
const isKnownUnit = (defID: string): boolean =>
  UNITS.some((u) => u.name === defID);

/** Add `delta` into `bag` for each non-zero entry. */
const addInto = (bag: ResourceBag, delta: Partial<ResourceBag>): void => {
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = delta[r];
    if (v !== undefined && v !== 0) bag[r] += v;
  }
};

export const foreignAssignDamage: Move<SettlementState> = (
  { G, ctx, events, playerID },
  allocations: ReadonlyArray<DamageAllocation>,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('foreign')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== STAGES.foreignAwaitingDamage) {
    return INVALID_MOVE;
  }

  const foreign = G.foreign;
  if (foreign === undefined) return INVALID_MOVE;

  const battle = foreign.inFlight.battle;
  if (battle === null) return INVALID_MOVE;

  if (!Array.isArray(allocations)) return INVALID_MOVE;

  // Sanity-check enemy unit names so a typo'd card doesn't get processed
  // as "no enemies" by the resolver.
  for (const u of battle.units) {
    if (!isKnownUnit(u.name)) return INVALID_MOVE;
  }

  const enemy = enemyFromCard(battle.units);
  // V1: enemy AI always picks the lowest-HP target. The resolver supports
  // other rules but no card today selects between them.
  const enemyDamageRule: EnemyDamageRule = 'attacksWeakest';

  const out = resolveBattle({
    player: foreign.inFlight.committed.map((u) => ({ ...u })),
    enemy,
    enemyDamageRule,
    damageAllocations: allocations,
  });

  if (out.validationErrors.length > 0) return INVALID_MOVE;
  if (out.outcome === 'mid') return INVALID_MOVE;

  foreign._lastRelease = undefined;

  const evts = events as StageEvents | undefined;

  if (out.outcome === 'win') {
    if (battle.reward !== undefined) {
      addInto(G.bank, battle.reward);
      appendBankLog(G, 'battleReward', battle.reward, `Battle ${battle.id}`);
    }

    // V1: every battle counts as joining a settlement on win unless the
    // card explicitly opts out via `joins: false`. The BattleCardDef shape
    // doesn't carry a `joins` field today; the optional read here keeps
    // future cards' opt-out cheap to wire in.
    const cardJoins = (battle as { joins?: boolean }).joins;
    if (cardJoins !== false) {
      G.settlementsJoined += 1;
    }

    // Collapse the resolver's surviving rows back into inPlay.
    foreign.inPlay = out.finalPlayer.map((u) => ({ ...u }));

    foreign.lastBattleOutcome = 'win';
    foreign.inFlight.battle = null;
    foreign.inFlight.committed = [];

    evts?.setStage?.(STAGES.foreignTurn);
    return;
  }

  // 'lose' branch.
  if (battle.failure !== undefined) {
    foreign.pendingTribute = { ...battle.failure.tribute };
  }
  foreign.lastBattleOutcome = 'lose';
  foreign.inFlight.battle = null;
  foreign.inFlight.committed = [];
  // Whatever survived is still on the board — no inPlay update on lose.

  if (!G.othersDone) G.othersDone = {};
  G.othersDone[playerID] = true;
  evts?.setStage?.(STAGES.done);
};
