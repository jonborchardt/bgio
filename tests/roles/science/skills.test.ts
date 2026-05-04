// Defense redesign 1.1 — SkillDef content table tests (D27).
//
// Phase 2 lands `scienceTeach`; 1.1 just lands the table. We assert the
// table stays internally consistent so a later edit (a new skill, a
// rebalance) can't silently break the assumptions the move will rely on.

import { describe, expect, it } from 'vitest';
import {
  SKILLS,
  SKILL_IDS,
  type SkillID,
} from '../../../src/game/roles/science/skills.ts';

describe('SKILLS content table (D27)', () => {
  it('every SKILL_IDS entry has a SkillDef and the id field matches the key', () => {
    for (const id of SKILL_IDS) {
      const def = SKILLS[id];
      expect(def, `missing SkillDef for ${id}`).toBeDefined();
      expect(def.id, `SKILLS[${id}].id mismatch`).toBe(id);
    }
  });

  it('every SkillDef has cost > 0', () => {
    for (const id of SKILL_IDS) {
      const def = SKILLS[id];
      expect(def.cost, `${id} cost`).toBeGreaterThan(0);
    }
  });

  it('SkillDef.name values are unique', () => {
    const names = SKILL_IDS.map((id) => SKILLS[id].name);
    const dedup = new Set(names);
    expect(dedup.size, 'duplicate SkillDef.name detected').toBe(names.length);
  });

  it('every effect.kind is a known PlacementEffect kind', () => {
    const known = new Set([
      'strength',
      'range',
      'regen',
      'hp',
      'firstStrike',
    ]);
    for (const id of SKILL_IDS) {
      const def = SKILLS[id];
      expect(known.has(def.effect.kind), `${id}.effect.kind`).toBe(true);
    }
  });

  it('exposes the union shape that scienceTeach will accept', () => {
    // Compile-time-ish check: a SkillID literal must index SKILLS without
    // a cast. If we ever accidentally widen `SkillID` to `string`, this
    // line stops type-checking.
    const id: SkillID = 'extendRange';
    expect(SKILLS[id].effect).toEqual({ kind: 'range', amount: 1 });
  });
});
