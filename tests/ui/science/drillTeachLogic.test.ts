// Defense redesign 3.7 — pure-logic tests for the science panel's
// Drill / Teach disabled-reason and formatting helpers.
//
// Each helper has a deterministic single-input flip per branch so tests
// can pin the entire decision tree by varying one field. The strings
// returned are also the user-visible tooltips, so these tests double as
// a copy lock.

import { describe, expect, it } from 'vitest';
import {
  cheapestSkillCost,
  drillDisabledReason,
  formatUnit,
  teachDisabledReason,
  teachUnitDisabledReason,
} from '../../../src/ui/science/drillTeachLogic.ts';
import { SKILLS } from '../../../src/game/roles/science/skills.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const mkUnit = (overrides: Partial<UnitInstance> = {}): UnitInstance => ({
  id: 'u1',
  defID: 'Brute',
  cellKey: '0,1',
  hp: 2,
  placementOrder: 0,
  ...overrides,
});

describe('drillDisabledReason', () => {
  const base = {
    canAct: true,
    drillUsed: false,
    stashScience: 5,
    drillCost: 1,
    units: [mkUnit()],
  };

  it('returns null when every branch is satisfied', () => {
    expect(drillDisabledReason(base)).toBeNull();
  });

  it("blocks when seat can't act (out of stage)", () => {
    expect(drillDisabledReason({ ...base, canAct: false })).toBe(
      "Wait for Science's turn.",
    );
  });

  it('blocks when the per-round latch is set', () => {
    expect(drillDisabledReason({ ...base, drillUsed: true })).toBe(
      'Already drilled a unit this round.',
    );
  });

  it('blocks when there are no units on the grid', () => {
    expect(drillDisabledReason({ ...base, units: [] })).toBe(
      'No units on the village grid yet.',
    );
  });

  it('blocks when stash falls below the drill cost', () => {
    expect(
      drillDisabledReason({ ...base, stashScience: 0, drillCost: 1 }),
    ).toBe('Need 1 science (have 0).');
  });

  it('latch beats stash — used wins over short stash', () => {
    expect(
      drillDisabledReason({
        ...base,
        drillUsed: true,
        stashScience: 0,
      }),
    ).toBe('Already drilled a unit this round.');
  });
});

describe('teachDisabledReason', () => {
  const base = {
    canAct: true,
    taughtUsed: false,
    stashScience: cheapestSkillCost,
    units: [mkUnit()],
  };

  it('returns null when every branch is satisfied', () => {
    expect(teachDisabledReason(base)).toBeNull();
  });

  it("blocks when seat can't act", () => {
    expect(teachDisabledReason({ ...base, canAct: false })).toBe(
      "Wait for Science's turn.",
    );
  });

  it('blocks when the per-round latch is set', () => {
    expect(teachDisabledReason({ ...base, taughtUsed: true })).toBe(
      'Already taught a unit this round.',
    );
  });

  it('blocks when there are no units on the grid', () => {
    expect(teachDisabledReason({ ...base, units: [] })).toBe(
      'No units on the village grid yet.',
    );
  });

  it("blocks when seat can't afford even the cheapest skill", () => {
    expect(
      teachDisabledReason({ ...base, stashScience: cheapestSkillCost - 1 }),
    ).toBe(
      `Need at least ${cheapestSkillCost} science (have ${cheapestSkillCost - 1}).`,
    );
  });

  it('cheapest skill cost matches the SKILLS table', () => {
    const min = Math.min(
      ...Object.values(SKILLS).map((s) => s.cost),
    );
    expect(cheapestSkillCost).toBe(min);
  });
});

describe('teachUnitDisabledReason', () => {
  const skill = SKILLS.extendRange;

  it('returns false when the unit can take the skill and stash covers cost', () => {
    expect(teachUnitDisabledReason(mkUnit(), skill, 5)).toBe(false);
  });

  it('refuses a unit that already learned the skill', () => {
    const unit = mkUnit({ taughtSkills: ['extendRange'] });
    expect(teachUnitDisabledReason(unit, skill, 5)).toBe(
      `${unit.defID} already has Extend Range.`,
    );
  });

  it('refuses when the stash falls short of the skill cost', () => {
    expect(teachUnitDisabledReason(mkUnit(), skill, skill.cost - 1)).toBe(
      `Need ${skill.cost} science (have ${skill.cost - 1}).`,
    );
  });

  it('already-taught beats short-stash', () => {
    const unit = mkUnit({ taughtSkills: ['extendRange'] });
    expect(teachUnitDisabledReason(unit, skill, 0)).toBe(
      `${unit.defID} already has Extend Range.`,
    );
  });
});

describe('formatUnit', () => {
  it('renders a single-line summary in the canonical format', () => {
    const unit = mkUnit({
      defID: 'Spear',
      hp: 3,
      cellKey: '1,-1',
      placementOrder: 7,
    });
    expect(formatUnit(unit)).toBe('Spear · hp 3 · tile 1,-1 · order #7');
  });
});
