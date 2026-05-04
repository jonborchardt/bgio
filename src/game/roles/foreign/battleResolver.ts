// Pure deterministic battle resolver.
//
// `resolveBattle(input)` runs a turn-by-turn simulation between a Foreign
// player's committed units and the units on a flipped battle card. There
// is NO randomness — battles in this design are read off the resolver's
// log like a film reel.
//
// V1 ability coverage (deliberate, mirrors abilities.ts):
//
//   * `focus`   — player units with focus pick the enemy with the highest
//                 attack. (V1 default: ALL player units use "highest attack"
//                 targeting; the focus tag exists for test parity but does
//                 not yet differentiate behavior.)
//   * `splash`  — attacker also hits a second enemy at full damage.
//   * `armor`   — defender absorbs 1 fewer damage per incoming hit
//                 (clamped at 0).
//   * `heal`    — a player unit with `heal` SKIPS its attack and instead
//                 restores 1 HP to the lowest-HP ally that isn't already
//                 at full HP. If no ally needs healing, the medic does
//                 nothing (still consumes its turn).
//   * `singleUse` — attacker drops out after one attack.
//
// V1 SKIPS: `cover`, `ammo`, `reload`, `vsBoss±N`, `revealsScout`,
// "−N initiative on turn 1", trapper post-attack initiative bumps,
// player-driven ability target selection. Multi-target absorption per
// "round" is also flattened: each enemy-on-player damage event consumes
// exactly one `DamageAllocation`, in resolver order.
//
// Determinism contract: given the same input, this function returns
// equal `log`, `outcome`, `finalPlayer`, `finalEnemy`, `validationErrors`.
// Every choice (target tie-breaks, splash secondary target) is
// "first-by-input-order" so the result is stable.

import type { UnitInstance } from './types.ts';
import type { UnitDef } from '../../../data/schema.ts';
import { UNITS } from '../../../data/index.ts';
import { abilitiesForUnit, parseAbilities } from './abilities.ts';
import type { AbilityTag } from './abilities.ts';

// --- public API ------------------------------------------------------------

export type EnemyDamageRule =
  | 'attacksWeakest' // lowest HP
  | 'attacksStrongest' // highest attack
  | 'attacksClosest' // first in input order
  | 'attacksMostDamage'; // highest attack (alias for V1)

export interface DamageAllocation {
  /** Map of player unit defID → damage absorbed by that unit this round. */
  byUnit: Record<string, number>;
}

export interface ResolverInput {
  player: UnitInstance[];
  enemy: UnitInstance[];
  enemyDamageRule: EnemyDamageRule;
  /** One entry per "incoming damage event" from enemy → player, in order. */
  damageAllocations: ReadonlyArray<DamageAllocation>;
  /**
   * Optional injection point for tests. When omitted, defs are looked up
   * in the bundled `UNITS` table. Tests pass synthetic UnitDefs through
   * here so they don't have to mutate the frozen UNITS array.
   */
  unitLookup?: (defID: string) => UnitDef | undefined;
}

export type BattleLogEvent =
  | {
      kind: 'attack';
      tick: number;
      attacker: string;
      target: string;
      amount: number;
    }
  | {
      kind: 'splash';
      tick: number;
      attacker: string;
      target: string;
      amount: number;
    }
  | {
      kind: 'heal';
      tick: number;
      medic: string;
      target: string;
      amount: number;
    }
  | { kind: 'death'; tick: number; unit: string; side: 'player' | 'enemy' }
  | { kind: 'allocation'; tick: number; index: number };

export interface ResolverOutput {
  log: BattleLogEvent[];
  outcome: 'win' | 'lose' | 'mid';
  finalPlayer: UnitInstance[];
  finalEnemy: UnitInstance[];
  validationErrors: string[];
}

// --- internals -------------------------------------------------------------

interface BattleRow {
  /** Stable label like `Spearman#0`. Used in log events. */
  label: string;
  defID: string;
  side: 'player' | 'enemy';
  initiative: number;
  attack: number;
  maxHp: number;
  hp: number;
  abilities: ReadonlyArray<AbilityTag>;
  exhausted: boolean;
  /** Position in the input list — used for "first-in-input" tie-breaking. */
  inputIndex: number;
}

const TICK_CAP = 200;

const lookupDef = (
  defID: string,
  override?: (defID: string) => UnitDef | undefined,
): UnitDef | undefined => {
  if (override !== undefined) return override(defID);
  return UNITS.find((u) => u.name === defID);
};

const abilitiesFor = (
  def: UnitDef,
  override?: (defID: string) => UnitDef | undefined,
): AbilityTag[] => {
  // When the caller supplied an override, the def may not be in UNITS, so
  // parse straight from the def. Otherwise reuse the cached lookup.
  if (override !== undefined) {
    return parseAbilities(`${def.altStats} ${def.note}`);
  }
  return abilitiesForUnit(def.name);
};

const expandSide = (
  units: UnitInstance[],
  side: 'player' | 'enemy',
  override: ((defID: string) => UnitDef | undefined) | undefined,
  errors: string[],
): BattleRow[] => {
  const rows: BattleRow[] = [];
  let inputIndex = 0;
  for (const inst of units) {
    const def = lookupDef(inst.defID, override);
    if (def === undefined) {
      errors.push(`unknown ${side} unit defID "${inst.defID}"`);
      continue;
    }
    const abilities = abilitiesFor(def, override);
    const hp = def.hp > 0 ? def.hp : 1;
    const count = inst.count > 0 ? inst.count : 1;
    for (let i = 0; i < count; i += 1) {
      rows.push({
        label: `${def.name}#${i}`,
        defID: def.name,
        side,
        initiative: def.initiative,
        attack: def.attack,
        maxHp: hp,
        hp,
        abilities,
        exhausted: false,
        inputIndex,
      });
      inputIndex += 1;
    }
  }
  return rows;
};

/** Stable sort: highest initiative first, ties preserve input order. */
const initiativeOrder = (rows: BattleRow[]): BattleRow[] => {
  const indexed = rows.map((r, i) => ({ row: r, i }));
  indexed.sort((a, b) => {
    if (a.row.initiative !== b.row.initiative) {
      return b.row.initiative - a.row.initiative;
    }
    return a.i - b.i;
  });
  return indexed.map((x) => x.row);
};

const isAlive = (r: BattleRow): boolean => r.hp > 0 && !r.exhausted;

/** Pick a target using the requested rule. Ties break by input order. */
const pickEnemyTarget = (
  rule: EnemyDamageRule,
  candidates: BattleRow[],
): BattleRow | undefined => {
  const alive = candidates.filter((c) => c.hp > 0);
  if (alive.length === 0) return undefined;
  if (rule === 'attacksClosest') {
    // First in input order.
    let best = alive[0];
    for (const c of alive) {
      if (c.inputIndex < best.inputIndex) best = c;
    }
    return best;
  }
  if (rule === 'attacksWeakest') {
    let best = alive[0];
    for (const c of alive) {
      if (
        c.hp < best.hp ||
        (c.hp === best.hp && c.inputIndex < best.inputIndex)
      ) {
        best = c;
      }
    }
    return best;
  }
  // attacksStrongest and attacksMostDamage: highest attack, ties → input
  // order.
  let best = alive[0];
  for (const c of alive) {
    if (
      c.attack > best.attack ||
      (c.attack === best.attack && c.inputIndex < best.inputIndex)
    ) {
      best = c;
    }
  }
  return best;
};

/**
 * Player target rule (V1, simplified): pick the enemy with the highest
 * attack; ties go to input order. `focus` flagged units use the same rule
 * — V1 does not yet differentiate, but the tag is still parsed so future
 * versions can layer in alternative selection.
 */
const pickPlayerTarget = (candidates: BattleRow[]): BattleRow | undefined => {
  const alive = candidates.filter((c) => c.hp > 0);
  if (alive.length === 0) return undefined;
  let best = alive[0];
  for (const c of alive) {
    if (
      c.attack > best.attack ||
      (c.attack === best.attack && c.inputIndex < best.inputIndex)
    ) {
      best = c;
    }
  }
  return best;
};

/** Splash secondary: any other living enemy in input order. */
const pickSplashSecondary = (
  primary: BattleRow,
  candidates: BattleRow[],
): BattleRow | undefined => {
  const alive = candidates.filter((c) => c.hp > 0 && c !== primary);
  if (alive.length === 0) return undefined;
  let best = alive[0];
  for (const c of alive) {
    if (c.inputIndex < best.inputIndex) best = c;
  }
  return best;
};

/** Lowest-HP ally that is not already at full HP. */
const pickHealTarget = (allies: BattleRow[]): BattleRow | undefined => {
  const candidates = allies.filter((a) => a.hp > 0 && a.hp < a.maxHp);
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  for (const c of candidates) {
    if (
      c.hp < best.hp ||
      (c.hp === best.hp && c.inputIndex < best.inputIndex)
    ) {
      best = c;
    }
  }
  return best;
};

const damageAfterArmor = (rawAttack: number, defender: BattleRow): number => {
  const reduced = defender.abilities.includes('armor')
    ? rawAttack - 1
    : rawAttack;
  return reduced > 0 ? reduced : 0;
};

/**
 * Validate that a single allocation absorbs exactly `incoming` damage
 * spread across living player units, with the per-unit "lethal-or-leftover"
 * rule. On any failure, push a string into `errors` (with the index) and
 * return false; the caller treats that as an aborted resolution.
 */
const validateAllocation = (
  alloc: DamageAllocation,
  index: number,
  incoming: number,
  player: BattleRow[],
  errors: string[],
): boolean => {
  let sum = 0;
  for (const v of Object.values(alloc.byUnit)) sum += v;
  if (sum !== incoming) {
    errors.push(
      `allocation ${index}: sum ${sum} does not match incoming damage ${incoming}`,
    );
    return false;
  }
  // Aggregate absorption per defID; check lethal-or-leftover against the
  // pool of HP belonging to that defID's living rows. We let the caller
  // distribute damage across rows of the same defID greedily, since the
  // input only carries a per-defID number.
  for (const [defID, absorbed] of Object.entries(alloc.byUnit)) {
    if (absorbed === 0) continue;
    if (absorbed < 0 || !Number.isInteger(absorbed)) {
      errors.push(
        `allocation ${index}: defID "${defID}" absorbed ${absorbed} (must be a non-negative integer)`,
      );
      return false;
    }
    const rows = player.filter((p) => p.defID === defID && p.hp > 0);
    if (rows.length === 0) {
      errors.push(
        `allocation ${index}: defID "${defID}" has no living units to absorb ${absorbed}`,
      );
      return false;
    }
    const totalHp = rows.reduce((acc, r) => acc + r.hp, 0);
    if (absorbed > totalHp) {
      errors.push(
        `allocation ${index}: defID "${defID}" absorbed ${absorbed} but only has ${totalHp} HP`,
      );
      return false;
    }
    // Lethal-or-leftover rule: leftover damage on a partially-damaged unit
    // must be strictly less than that unit's remaining HP. Since we
    // distribute greedily (full-kill rows first), the only "leftover" unit
    // is the last one touched; if `absorbed - sum(killedRows.hp) < lastRow.hp`
    // we're fine. Anything else means a unit was killed without absorbing
    // its full HP, which the rules disallow.
    let remaining = absorbed;
    const sorted = [...rows].sort((a, b) => a.inputIndex - b.inputIndex);
    for (const row of sorted) {
      if (remaining <= 0) break;
      if (remaining >= row.hp) {
        remaining -= row.hp;
      } else {
        // Leftover < row.hp ⇒ valid partial. Done.
        remaining = 0;
        break;
      }
    }
    if (remaining !== 0) {
      // Should be unreachable given the totalHp check above, but kept for
      // safety: would mean we ran out of rows with damage to spare.
      errors.push(
        `allocation ${index}: defID "${defID}" left ${remaining} damage unallocated`,
      );
      return false;
    }
  }
  return true;
};

/** Apply a validated allocation to the live player rows. */
const applyAllocation = (
  alloc: DamageAllocation,
  player: BattleRow[],
  tick: number,
  log: BattleLogEvent[],
): void => {
  for (const [defID, absorbed] of Object.entries(alloc.byUnit)) {
    if (absorbed === 0) continue;
    let remaining = absorbed;
    const rows = player
      .filter((p) => p.defID === defID && p.hp > 0)
      .sort((a, b) => a.inputIndex - b.inputIndex);
    for (const row of rows) {
      if (remaining <= 0) break;
      if (remaining >= row.hp) {
        remaining -= row.hp;
        row.hp = 0;
        log.push({ kind: 'death', tick, unit: row.label, side: 'player' });
      } else {
        row.hp -= remaining;
        remaining = 0;
      }
    }
  }
};

/** Collapse rows back into UnitInstance[] by counting living rows per defID. */
const collapseRows = (rows: BattleRow[]): UnitInstance[] => {
  const counts = new Map<string, number>();
  // Preserve first-seen order so the output mirrors the input layout.
  const order: string[] = [];
  for (const r of rows) {
    if (r.hp <= 0 || r.exhausted) continue;
    if (!counts.has(r.defID)) order.push(r.defID);
    counts.set(r.defID, (counts.get(r.defID) ?? 0) + 1);
  }
  return order.map((defID) => ({
    defID,
    count: counts.get(defID) ?? 0,
  }));
};

// --- main resolver ---------------------------------------------------------

export const resolveBattle = (input: ResolverInput): ResolverOutput => {
  const log: BattleLogEvent[] = [];
  const validationErrors: string[] = [];

  const playerRows = expandSide(
    input.player,
    'player',
    input.unitLookup,
    validationErrors,
  );
  const enemyRows = expandSide(
    input.enemy,
    'enemy',
    input.unitLookup,
    validationErrors,
  );

  // Combined initiative order. Recomputed each round so future "trapper
  // bump" abilities can mutate initiative; in V1 the order is static.
  let allocIndex = 0;
  let outcome: 'win' | 'lose' | 'mid' | undefined;
  let tick = 0;

  // If a side starts empty, short-circuit.
  if (enemyRows.length === 0 && playerRows.length === 0) {
    return {
      log,
      outcome: 'lose', // arbitrary; matches "player has nothing"
      finalPlayer: [],
      finalEnemy: [],
      validationErrors,
    };
  }
  if (enemyRows.length === 0) {
    return {
      log,
      outcome: 'win',
      finalPlayer: collapseRows(playerRows),
      finalEnemy: [],
      validationErrors,
    };
  }
  if (playerRows.length === 0) {
    return {
      log,
      outcome: 'lose',
      finalPlayer: [],
      finalEnemy: collapseRows(enemyRows),
      validationErrors,
    };
  }

  outer: while (tick < TICK_CAP) {
    const order = initiativeOrder([...playerRows, ...enemyRows]);
    let actedThisRound = false;

    for (const actor of order) {
      if (!isAlive(actor)) continue;
      tick += 1;
      if (tick > TICK_CAP) break;
      actedThisRound = true;

      const ownSide = actor.side === 'player' ? playerRows : enemyRows;
      const otherSide = actor.side === 'player' ? enemyRows : playerRows;

      // Heal-first: medics never attack while there's a wounded ally.
      if (actor.abilities.includes('heal')) {
        const target = pickHealTarget(ownSide);
        if (target !== undefined) {
          target.hp += 1;
          if (target.hp > target.maxHp) target.hp = target.maxHp;
          log.push({
            kind: 'heal',
            tick,
            medic: actor.label,
            target: target.label,
            amount: 1,
          });
        }
        // No attack on heal turns.
        continue;
      }

      const target =
        actor.side === 'player'
          ? pickPlayerTarget(otherSide)
          : pickEnemyTarget(input.enemyDamageRule, otherSide);
      if (target === undefined) {
        // Nothing to hit — other side already empty. Loop will detect win.
        break;
      }

      const dmg = damageAfterArmor(actor.attack, target);
      target.hp -= dmg;
      log.push({
        kind: 'attack',
        tick,
        attacker: actor.label,
        target: target.label,
        amount: dmg,
      });
      const targetDied = target.hp <= 0;
      if (targetDied) {
        log.push({
          kind: 'death',
          tick,
          unit: target.label,
          side: target.side,
        });
      }

      // Splash secondary at full damage (modulo the splash target's own
      // armor). Counts as a SECOND incoming-damage event when the
      // attacker is the enemy.
      let splashDmg = 0;
      let splashTarget: BattleRow | undefined;
      if (actor.abilities.includes('splash')) {
        splashTarget = pickSplashSecondary(target, otherSide);
        if (splashTarget !== undefined) {
          splashDmg = damageAfterArmor(actor.attack, splashTarget);
          splashTarget.hp -= splashDmg;
          log.push({
            kind: 'splash',
            tick,
            attacker: actor.label,
            target: splashTarget.label,
            amount: splashDmg,
          });
          if (splashTarget.hp <= 0) {
            log.push({
              kind: 'death',
              tick,
              unit: splashTarget.label,
              side: splashTarget.side,
            });
          }
        }
      }

      // After every enemy → player damage event, consume an allocation.
      // (Splash is a separate event.)
      if (actor.side === 'enemy') {
        // Primary hit: even when the target died, the allocation framework
        // expects an entry. We undo the direct hp damage we just applied
        // and let the validated allocation re-apply it, so the books match.
        if (dmg > 0) {
          // Roll back the direct damage; allocation owns the bookkeeping.
          target.hp += dmg;
          if (allocIndex >= input.damageAllocations.length) {
            validationErrors.push(
              `missing allocation at index ${allocIndex} for ${dmg} incoming`,
            );
            outcome = 'mid';
            break outer;
          }
          const alloc = input.damageAllocations[allocIndex];
          const ok = validateAllocation(
            alloc,
            allocIndex,
            dmg,
            playerRows,
            validationErrors,
          );
          log.push({ kind: 'allocation', tick, index: allocIndex });
          if (!ok) {
            outcome = 'mid';
            allocIndex += 1;
            break outer;
          }
          applyAllocation(alloc, playerRows, tick, log);
          allocIndex += 1;
        }
        if (splashTarget !== undefined && splashDmg > 0) {
          splashTarget.hp += splashDmg;
          if (allocIndex >= input.damageAllocations.length) {
            validationErrors.push(
              `missing allocation at index ${allocIndex} for ${splashDmg} incoming (splash)`,
            );
            outcome = 'mid';
            break outer;
          }
          const alloc = input.damageAllocations[allocIndex];
          const ok = validateAllocation(
            alloc,
            allocIndex,
            splashDmg,
            playerRows,
            validationErrors,
          );
          log.push({ kind: 'allocation', tick, index: allocIndex });
          if (!ok) {
            outcome = 'mid';
            allocIndex += 1;
            break outer;
          }
          applyAllocation(alloc, playerRows, tick, log);
          allocIndex += 1;
        }
      }

      if (actor.abilities.includes('singleUse')) {
        actor.exhausted = true;
      }

      // Termination check.
      if (playerRows.every((p) => p.hp <= 0)) {
        outcome = 'lose';
        break outer;
      }
      if (enemyRows.every((e) => e.hp <= 0)) {
        outcome = 'win';
        break outer;
      }
    }

    if (!actedThisRound) {
      // Stalemate: nobody alive enough to act. Shouldn't happen given the
      // termination checks above, but cap the loop defensively.
      break;
    }
  }

  if (outcome === undefined) {
    // Hit the tick cap — call it 'mid' and surface a validation error so
    // the caller knows the simulation didn't terminate cleanly.
    if (playerRows.every((p) => p.hp <= 0)) outcome = 'lose';
    else if (enemyRows.every((e) => e.hp <= 0)) outcome = 'win';
    else {
      outcome = 'mid';
      validationErrors.push(`tick cap (${TICK_CAP}) hit before resolution`);
    }
  }

  return {
    log,
    outcome,
    finalPlayer: collapseRows(playerRows),
    finalEnemy: collapseRows(enemyRows),
    validationErrors,
  };
};
