// allocator (14.10) — pure helpers for the AssignDamageDialog.
//
// The 07.3 resolver consumes one `DamageAllocation` per incoming-damage
// event from enemy → player, in resolver order. The number of events is
// not knowable from the input alone — armor reduces some hits to 0 (no
// allocation), splash adds extra events, and dead units stop attacking.
//
// `discoverIncomingEvents` runs the resolver iteratively with a
// kill-from-first greedy allocation each step, capturing the
// `incoming` size of each event the resolver reported as missing. The
// returned array is the per-event "incoming damage" the player must
// distribute across their units in the dialog.
//
// `greedyAllocation(rows, incoming)` builds the lowest-HP-first default
// allocation that the dialog pre-fills. The same scheme drives
// `discoverIncomingEvents` — it's a sane plan that passes the
// resolver's lethal-or-leftover validator.
//
// Pure module — no React, no boardgame.io.

import {
  resolveBattle,
  type DamageAllocation,
  type EnemyDamageRule,
  type ResolverInput,
  type ResolverOutput,
} from '../../game/roles/foreign/battleResolver.ts';
import type { UnitInstance } from '../../game/roles/foreign/types.ts';
import { UNITS } from '../../data/index.ts';

export interface PlayerRow {
  defID: string;
  /** Total HP of all units of this defID currently alive. Used as the
   *  per-defID stepper cap in the dialog. */
  totalHp: number;
  /** Total live count for the defID. Cosmetic — the dialog labels rows
   *  "Brute ×2 (6 HP total)". */
  count: number;
}

const lookupHp = (defID: string): number => {
  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return 1;
  return def.hp > 0 ? def.hp : 1;
};

/** Collapse `inPlay` into per-defID rows annotated with totalHp/count. */
export const playerRowsFor = (inPlay: ReadonlyArray<UnitInstance>): PlayerRow[] => {
  const rows: PlayerRow[] = [];
  for (const inst of inPlay) {
    if (inst.count <= 0) continue;
    rows.push({
      defID: inst.defID,
      totalHp: lookupHp(inst.defID) * inst.count,
      count: inst.count,
    });
  }
  return rows;
};

/**
 * Build a greedy "kill the lowest-HP defID first, then partial overflow"
 * allocation summing to exactly `incoming`. The result satisfies the
 * resolver's lethal-or-leftover rule (a defID either dies completely or
 * absorbs strictly less than its remaining HP) — see `validateAllocation`
 * in battleResolver.ts.
 *
 * Returns null when the player rows hold less HP than `incoming` (the
 * fight would over-kill the player). Caller renders that as a "no valid
 * plan" branch.
 */
export const greedyAllocation = (
  rows: ReadonlyArray<PlayerRow>,
  incoming: number,
): DamageAllocation | null => {
  if (incoming === 0) return { byUnit: {} };
  const totalHp = rows.reduce((acc, r) => acc + r.totalHp, 0);
  if (incoming > totalHp) return null;

  // Sort lowest-HP first so cheap units die first and any partial
  // leftover lands on the highest-HP defID, which makes the partial
  // safer (a single Brute with 6 HP absorbing 2 is fine).
  const sorted = [...rows].sort((a, b) => a.totalHp - b.totalHp);
  const out: Record<string, number> = {};
  let remaining = incoming;
  for (const row of sorted) {
    if (remaining <= 0) break;
    const take = remaining >= row.totalHp ? row.totalHp : remaining;
    out[row.defID] = take;
    remaining -= take;
  }
  return { byUnit: out };
};

export interface IncomingEvent {
  /** Damage amount the dialog must absorb. */
  incoming: number;
  /** Greedy default allocation; null if the player has < incoming HP. */
  defaultAllocation: DamageAllocation | null;
}

const MISSING_ALLOC_RE =
  /missing allocation at index (\d+) for (\d+) incoming/;

/**
 * Iteratively run the resolver with greedy allocations to discover the
 * sequence of incoming-damage events the player needs to absorb.
 *
 * `maxEvents` caps the loop defensively — battles with armor + splash +
 * many enemies produce a bounded but variable number of events.
 */
export const discoverIncomingEvents = (
  args: {
    player: UnitInstance[];
    enemy: UnitInstance[];
    enemyDamageRule: EnemyDamageRule;
    unitLookup?: ResolverInput['unitLookup'];
  },
  maxEvents: number = 64,
): IncomingEvent[] => {
  const events: IncomingEvent[] = [];
  const allocations: DamageAllocation[] = [];

  for (let step = 0; step < maxEvents; step += 1) {
    const out: ResolverOutput = resolveBattle({
      player: args.player,
      enemy: args.enemy,
      enemyDamageRule: args.enemyDamageRule,
      damageAllocations: allocations,
      unitLookup: args.unitLookup,
    });
    // Find a "missing allocation" error at exactly the next index.
    const expectedIndex = allocations.length;
    const match = out.validationErrors
      .map((e) => MISSING_ALLOC_RE.exec(e))
      .find((m) => m !== null && Number(m[1]) === expectedIndex);
    if (!match) break;

    const incoming = Number(match[2]);
    // Compute the greedy allocation against a snapshot of player rows
    // *as they stand at this point in the resolver*. We rebuild the
    // rows from scratch each step using the resolver-reported
    // finalPlayer state; that's the live HP roster after the previous
    // events resolved.
    const livePlayer = out.finalPlayer.length > 0 ? out.finalPlayer : args.player;
    const rows = playerRowsFor(livePlayer);
    const greedy = greedyAllocation(rows, incoming);
    events.push({ incoming, defaultAllocation: greedy });

    // If we can't fill the next step (over-kill), bail — the dialog
    // will still let the player attempt manually, but iterative
    // discovery can't continue.
    if (greedy === null) break;
    allocations.push(greedy);
  }

  return events;
};

/** Sum a DamageAllocation across defIDs. */
export const sumAllocation = (alloc: DamageAllocation): number => {
  let s = 0;
  for (const v of Object.values(alloc.byUnit)) s += v;
  return s;
};
