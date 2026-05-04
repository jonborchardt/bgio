// Defense redesign 3.7 — pure logic helpers for the science seat's
// Drill / Teach controls.
//
// Keeping the disabled / status branches in a non-component module:
//
//   1. lets the SciencePanel sub-components stay one-thing-each (the
//      `react-refresh/only-export-components` lint rule), and
//   2. lets tests pin each branch with a single-input change without
//      spinning a full render tree.
//
// All helpers are deterministic and side-effect free. The strings they
// return are the exact tooltips / row captions surfaced in the UI, so a
// test that asserts on the string also documents the user-visible copy.

import type { UnitInstance } from '../../game/roles/defense/types.ts';
import {
  SKILLS,
  SKILL_IDS,
  type SkillDef,
} from '../../game/roles/science/skills.ts';

export interface DrillDisabledArgs {
  canAct: boolean;
  drillUsed: boolean;
  stashScience: number;
  drillCost: number;
  units: ReadonlyArray<UnitInstance>;
}

/**
 * Returns the reason the Drill button should be disabled, or `null`
 * when the button is enabled. Branch order matters — the most actionable
 * reason wins (turn / latch / no-units / can't-afford).
 */
export const drillDisabledReason = (
  args: DrillDisabledArgs,
): string | null => {
  if (!args.canAct) return "Wait for Science's turn.";
  if (args.drillUsed) return 'Already drilled a unit this round.';
  if (args.units.length === 0) return 'No units on the village grid yet.';
  if (args.stashScience < args.drillCost) {
    return `Need ${args.drillCost} science (have ${args.stashScience}).`;
  }
  return null;
};

export interface TeachDisabledArgs {
  canAct: boolean;
  taughtUsed: boolean;
  stashScience: number;
  units: ReadonlyArray<UnitInstance>;
}

/** Cheapest skill in the SKILLS table, computed once at module load. */
export const cheapestSkillCost = Math.min(
  ...SKILL_IDS.map((id) => SKILLS[id].cost),
);

/**
 * Returns the reason the Teach trigger button should be disabled, or
 * `null` when it is enabled. The "no skill is affordable" branch fires
 * when the seat can't afford even the cheapest entry in `SKILLS`.
 */
export const teachDisabledReason = (
  args: TeachDisabledArgs,
): string | null => {
  if (!args.canAct) return "Wait for Science's turn.";
  if (args.taughtUsed) return 'Already taught a unit this round.';
  if (args.units.length === 0) return 'No units on the village grid yet.';
  if (args.stashScience < cheapestSkillCost) {
    return `Need at least ${cheapestSkillCost} science (have ${args.stashScience}).`;
  }
  return null;
};

/**
 * Reason a (skill, unit) pair would be rejected by `scienceTeach`.
 * Returns `false` (good to go) or a string explanation. Used to drive
 * the per-row disabled state in the unit picker after a skill is
 * chosen — the move would still INVALID_MOVE on its own, but the UI
 * surfaces the *why*.
 */
export const teachUnitDisabledReason = (
  unit: UnitInstance,
  skill: SkillDef,
  stashScience: number,
): false | string => {
  const taught = unit.taughtSkills ?? [];
  if (taught.includes(skill.id)) {
    return `${unit.defID} already has ${skill.name}.`;
  }
  if (stashScience < skill.cost) {
    return `Need ${skill.cost} science (have ${stashScience}).`;
  }
  return false;
};

/**
 * Compact one-line summary of a unit. The tile location is the cellKey
 * verbatim — the surrounding UI already explains the coordinate
 * convention.
 */
export const formatUnit = (unit: UnitInstance): string =>
  `${unit.defID} · hp ${unit.hp} · tile ${unit.cellKey} · order #${unit.placementOrder}`;
