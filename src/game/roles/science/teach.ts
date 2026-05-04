// Defense redesign 2.6 (D27) — `scienceTeach` move.
//
// The Science seat pays a `science` cost from their stash (read off the
// SKILLS table per skill) and applies one durable skill to a chosen unit
// on the village grid. The resolver folds taught skills into the unit's
// effective stats at fire time (range / strength / firstStrike) and
// applies the +HP / +regen variants at place / round-end (see
// resolver.ts header for the full taxonomy).
//
// Validations (in order):
//   1. caller has a defined playerID and holds the `science` role,
//   2. caller is in stage `scienceTurn` (parallel-actives gate),
//   3. `G.science` exists and the per-round latch is unset,
//   4. `skillID` resolves in `SKILLS`,
//   5. unit lookup: `unitID` resolves to an entry in `G.defense.inPlay`,
//   6. unit hasn't already learned `skillID` (idempotency — refusing
//      duplicates avoids letting the science seat dump stash by re-
//      teaching the same skill),
//   7. seat's stash covers the skill's cost.
//
// On success: pay the cost, append `skillID` to `unit.taughtSkills`,
// apply the durable side-effects (`reinforce` bumps `unit.hp`; the
// resolver handles range / strength / firstStrike at fire time so we
// only need to mutate hp here for the off-fire skills), and set the
// per-round latch.
//
// Round-end clearing of `scienceTaughtUsed` is owned by the
// `science:reset-defense-moves` hook registered in `drill.ts` (one hook
// covers both per-round flags).

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { clearUndoable } from '../../undo.ts';
import { SKILLS, type SkillID } from './skills.ts';

export const scienceTeach: Move<SettlementState> = (
  { G, ctx, playerID },
  unitID: string,
  skillID: SkillID,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return INVALID_MOVE;

  const science = G.science;
  if (science === undefined) return INVALID_MOVE;

  // Once-per-round latch.
  if (science.scienceTaughtUsed === true) return INVALID_MOVE;

  if (typeof skillID !== 'string' || skillID.length === 0) {
    return INVALID_MOVE;
  }
  const skill = SKILLS[skillID as SkillID];
  if (skill === undefined) return INVALID_MOVE;

  if (typeof unitID !== 'string' || unitID.length === 0) {
    return INVALID_MOVE;
  }
  const defense = G.defense;
  if (defense === undefined) return INVALID_MOVE;
  const unit = defense.inPlay.find((u) => u.id === unitID);
  if (unit === undefined) return INVALID_MOVE;

  // Idempotency — refuse duplicate skill on same unit.
  const taught = unit.taughtSkills ?? [];
  if (taught.includes(skillID)) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = { science: skill.cost };
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  // All gates passed — pay, attach skill, latch.
  clearUndoable(G);
  payFromStash(G, playerID, cost);

  if (unit.taughtSkills === undefined) unit.taughtSkills = [];
  unit.taughtSkills.push(skillID);

  // Apply durable side-effects that don't live on fire-time stats:
  //   - `reinforce` bumps current hp (the resolver folds the +1 max via
  //     the stat path; without bumping current hp here the unit would
  //     be capped at its old HP). We don't store maxHp on the instance
  //     today — the resolver derives effective max from def.hp + skill
  //     deltas at fire time — so a single hp bump models the spec ("+1
  //     max HP — current HP also +1").
  //   - `accelerate` is round-end regen; nothing to do at apply time.
  //     Phase 2.8's regen pass folds taught `accelerate` into the
  //     per-round HP top-up.
  //   - `extendRange`, `sharpen`, `firstStrike` are fire-time only and
  //     are handled by `computeStats` in the resolver.
  if (skillID === 'reinforce') {
    unit.hp += 1;
  }

  science.scienceTaughtUsed = true;
};
