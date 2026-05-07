// Defense redesign D27 — content table for the science role's "Teach a
// skill" move. The Phase 2 `scienceTeach` move pays a science cost from
// the science seat's stash, picks a unit on the village grid, and applies
// the chosen `SkillDef.effect` durably to that unit instance. The combat
// resolver (Phase 2) layers `taughtSkills` on top of base unit stats at
// fire time using the same `PlacementEffect` taxonomy that authors
// per-unit placement bonuses (D18) — one applier covers both shapes.
//
// 1.1 lands the table; nothing reads it at runtime yet. Tests assert the
// table is internally consistent so the eventual move can rely on
// "every SkillID has a SkillDef, all costs > 0, no duplicate names."
//
// Pure module — no boardgame.io imports, no React. Importable from both
// game logic and tests.

import type { PlacementEffect } from '../../../data/schema.ts';

export type SkillID =
  | 'extendRange'
  | 'reinforce'
  | 'accelerate'
  | 'sharpen'
  | 'firstStrike';

export interface SkillDef {
  id: SkillID;
  /** Human-readable label for the panel / card preview. */
  name: string;
  /** Plain-text rules text for the panel / card preview. */
  description: string;
  /** Science cost from the science seat's stash. Always > 0. */
  cost: number;
  /**
   * Effect to apply to the chosen unit instance at fire time. Reuses the
   * same shape as `PlacementBonus.effect` so a single resolver applier
   * can handle taught skills and placement bonuses uniformly.
   */
  effect: PlacementEffect;
}

export const SKILLS: Readonly<Record<SkillID, SkillDef>> = {
  extendRange: {
    id: 'extendRange',
    name: 'Extend Range',
    description: '+1 Chebyshev range — the unit defends one more tile out.',
    cost: 2,
    effect: { kind: 'range', amount: 1 },
  },
  reinforce: {
    id: 'reinforce',
    name: 'Reinforce',
    description: '+1 max HP — the unit (and its current HP) gain a point.',
    cost: 3,
    effect: { kind: 'hp', amount: 1 },
  },
  accelerate: {
    id: 'accelerate',
    name: 'Accelerate',
    description: '+1 regen — the unit recovers a little more between rounds.',
    cost: 2,
    effect: { kind: 'regen', amount: 1 },
  },
  sharpen: {
    id: 'sharpen',
    name: 'Sharpen',
    description: '+1 strength — the unit hits a little harder on every fire.',
    cost: 3,
    effect: { kind: 'strength', amount: 1 },
  },
  firstStrike: {
    id: 'firstStrike',
    name: 'First Strike',
    description: 'Grants first-strike — fires before non-first-strike units.',
    cost: 4,
    effect: { kind: 'firstStrike' },
  },
};

/** Convenience iterator: every skill ID, in declaration order. */
export const SKILL_IDS: ReadonlyArray<SkillID> = Object.keys(SKILLS) as SkillID[];
