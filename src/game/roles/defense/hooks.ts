// Defense redesign 2.8 — round-end hooks owned by the defense role.
//
// Two hooks live here, registered at module load against the shared 02.5
// hook registry:
//
//   1. `defense:regen-units`   — applies each unit's printed `regen` HP
//      (plus any taught `accelerate` skills) to the unit's current HP,
//      capped at the unit's effective max HP. Runs first so units that
//      survived the round's combat top up before the modifier sweep
//      below; units that died this round are already removed from
//      `inPlay` (the resolver filters them out at the moment they hit 0
//      HP) so this hook never resurrects.
//
//   2. `defense:clear-modifiers` — expires any track-flipped modifiers
//      that the conditioned moves didn't consume during the round (spec
//      §2 D20: "modifiers bend rules for one round"). For each entry in
//      `G.track.activeModifiers`, splice one matching-kind effect out of
//      `G._modifiers` (which is the queue the dispatcher's
//      `hasModifierActive` / `consumeModifier` consult); then clear
//      `activeModifiers`. Already-consumed modifiers were popped off
//      `_modifiers` by their conditioned move and the splice here finds
//      nothing for that kind — that's the intended path.
//
// Drill markers (`UnitInstance.drillToken`) are NOT cleared by either
// hook — the spec says "persist until consumed" (a drill marker on a
// unit that didn't fire this round carries into the next round). The
// per-round latches `science.scienceDrillUsed` / `scienceTaughtUsed`
// (the once-per-round science move gates) are reset by the
// `science:reset-defense-moves` hook in `roles/science/drill.ts`; that
// is a different concept and stays where it lives.
//
// Effective max HP for the regen cap mirrors the resolver's stat fold:
// `def.hp + sum(skill.effect.amount for kind === 'hp' in taughtSkills)`.
// The placement-bonus `hp` slot is intentionally NOT folded in because
// `scienceTeach`'s `reinforce` skill bumps current HP at teach time
// (and the resolver still derives effective max from def + skills); a
// placement bonus that ALSO bumped max HP would double-count in the
// regen cap. V1 ships no placement bonus with `kind: 'hp'`, so the
// observable behavior matches the spec.
//
// Pure module — no boardgame.io imports beyond the registry.

import { UNITS } from '../../../data/index.ts';
import { registerRoundEndHook } from '../../hooks.ts';
import { SKILLS, type SkillID } from '../science/skills.ts';

/**
 * Effective max HP for a unit instance: the unit def's printed HP plus
 * any durable `+hp` taught skills. See module-level note for why
 * placement bonuses are excluded.
 */
const effectiveMaxHp = (defID: string, taughtSkills: string[]): number => {
  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return 0;
  let max = def.hp;
  for (const id of taughtSkills) {
    const skill = SKILLS[id as SkillID];
    if (skill === undefined) continue;
    if (skill.effect.kind === 'hp') max += skill.effect.amount;
  }
  return max;
};

/**
 * Effective regen for a unit instance: the unit def's printed `regen`
 * plus any durable `accelerate` taught skills. Returns 0 when the unit's
 * def is missing (defensive — shouldn't happen, but safer than NaN).
 */
const effectiveRegen = (defID: string, taughtSkills: string[]): number => {
  const def = UNITS.find((u) => u.name === defID);
  if (def === undefined) return 0;
  let regen = def.regen;
  for (const id of taughtSkills) {
    const skill = SKILLS[id as SkillID];
    if (skill === undefined) continue;
    if (skill.effect.kind === 'regen') regen += skill.effect.amount;
  }
  return regen;
};

// Round-end hook 1 — apply regen to surviving units. Cap at effective
// max HP (see module note). 0-regen units are no-ops; full-HP units are
// no-ops; both branches early-return cheaply.
registerRoundEndHook('defense:regen-units', (G) => {
  const defense = G.defense;
  if (defense === undefined) return;
  for (const unit of defense.inPlay) {
    if (unit.hp <= 0) continue; // defensive — dead units shouldn't be here
    const taught = unit.taughtSkills ?? [];
    const regen = effectiveRegen(unit.defID, taught);
    if (regen <= 0) continue;
    const max = effectiveMaxHp(unit.defID, taught);
    if (unit.hp >= max) continue;
    unit.hp = Math.min(max, unit.hp + regen);
  }
});

// Round-end hook 2 — expire unconsumed track-flipped modifiers.
registerRoundEndHook('defense:clear-modifiers', (G) => {
  if (G.track === undefined) return;
  const cards = G.track.activeModifiers;
  if (cards === undefined || cards.length === 0) return;
  const stack = G._modifiers;
  if (stack !== undefined) {
    for (const card of cards) {
      const effect = card.effect as { kind?: string } | undefined;
      const kind = effect?.kind;
      if (kind === undefined) continue;
      const idx = stack.findIndex((m) => m.kind === kind);
      if (idx >= 0) stack.splice(idx, 1);
    }
  }
  // Hard reset rather than `length = 0` so the slot returns to its
  // initial-undefined-equivalent shape (an empty array). Either form is
  // observable as "no active modifiers"; the resolver lazy-inits when
  // pushing.
  G.track.activeModifiers = [];
});
