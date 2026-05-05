// Defense redesign 2.7 — boss resolution.
//
// The boss is the unique, terminal card on the Global Event Track (D21).
// When it flips, three printed thresholds are checked against the live
// game state, each met threshold removes one attack from the boss's
// `baseAttacks` budget, and each remaining attack is dispatched as a
// synthetic `ThreatCard` through the existing `resolveThreat` pipeline
// from 2.3. After the last attack lands, `G.bossResolved` flips to
// `true`, which is the single state flag `endConditions.endIf` watches
// to return `{ kind: 'win' }` (D25). All boss attacks resolve in the
// same round as the flip — the chief who flipped does not get a
// preparatory window.
//
// Per spec D26 ("no fail mode"), the village wins even if its last
// building is razed during the boss's last attack — the win flag fires
// regardless of how the threats unfolded. The score recording in
// `endConditions.onEnd` reads `G` after the dust settles.
//
// Threshold semantics:
//   - `science`: count of completed science cards on `G.science.completed`
//     (the canonical roster of "we finished researching this").
//   - `economy`: bank gold (`G.bank.gold`).
//   - `military`: sum of `UnitDef.attack` for every unit currently on
//     the village grid (`G.defense.inPlay`). The unit's printed `attack`
//     stat is the canonical "strength" lever per spec §5.
//
// Attacks model:
//   `attacks = max(0, baseAttacks - thresholdsMet)`. With the V1 boss
//   shipping `baseAttacks: 4`, full prep clamps to 1 attack. If a
//   future boss prints `baseAttacks <= 3`, full prep can yield 0
//   attacks and the boss is trivially defeated — the loop simply
//   doesn't run. The `attackPattern` is treated as a cycle: when
//   `attacks` exceeds `attackPattern.length`, indices wrap modulo the
//   pattern length. The 2.1 schema validator already enforces a
//   non-empty pattern.

import type { SettlementState } from '../types.ts';
import type { BossCard, ThreatCard } from '../../data/schema.ts';
import { UNITS } from '../../data/index.ts';
import type { RandomAPI } from '../random.ts';
import { resolveThreat } from './resolver.ts';

/** Count completed science cards. Uses `G.science.completed` (the canonical
 *  list maintained by `scienceComplete`); returns 0 when science state is
 *  absent so older fixtures don't crash the threshold check. */
export const countCompletedScience = (G: SettlementState): number => {
  const science = G.science;
  if (science === undefined) return 0;
  return science.completed.length;
};

/** Sum of unit-def `attack` (printed "strength" per spec §5) across every
 *  unit on the grid. Units whose `defID` doesn't resolve to a known
 *  `UnitDef` contribute 0 — keeps the boss math soft against test
 *  fixtures that seed synthetic units. */
export const sumUnitStrength = (G: SettlementState): number => {
  const inPlay = G.defense?.inPlay ?? [];
  let total = 0;
  for (const u of inPlay) {
    const def = UNITS.find((d) => d.name === u.defID);
    if (def !== undefined) total += def.attack;
  }
  return total;
};

/** Count met thresholds. Exported so the UI's progress widgets can
 *  reuse the exact same counting logic when telegraphing "you've met
 *  X of 2 thresholds" before the flip lands. The economy threshold
 *  reads `G.economyHigh` (the running maximum) rather than the current
 *  bank gold so a chief who briefly stockpiles can't lose the
 *  threshold by spending afterwards. */
export const countMetThresholds = (
  G: SettlementState,
  card: BossCard,
): number => {
  let met = 0;
  if (countCompletedScience(G) >= card.thresholds.science) met += 1;
  if ((G.economyHigh ?? G.bank.gold ?? 0) >= card.thresholds.economy) met += 1;
  return met;
};

/**
 * Resolve the boss card. Computes the number of attacks remaining after
 * thresholds are subtracted from `baseAttacks`, fires each attack as a
 * synthetic threat through `resolveThreat`, then flips `G.bossResolved`
 * to `true`. Mutates `G` in place — boardgame.io wraps the call in
 * Immer at the move site, so direct mutation is the idiomatic style.
 */
export const resolveBoss = (
  G: SettlementState,
  random: RandomAPI,
  card: BossCard,
): void => {
  const met = countMetThresholds(G, card);
  const attacks = Math.max(0, card.baseAttacks - met);

  // Defensive: an empty attackPattern means we have no shape to feed
  // resolveThreat. The 2.1 schema loader already rejects empty patterns,
  // so this branch only protects synthetic test fixtures.
  if (attacks > 0 && card.attackPattern.length > 0) {
    for (let i = 0; i < attacks; i += 1) {
      const pattern = card.attackPattern[i % card.attackPattern.length];
      if (pattern === undefined) continue;
      const synthetic: ThreatCard = {
        kind: 'threat',
        id: `${card.id}-attack-${i + 1}`,
        name: `${card.name} (attack ${i + 1})`,
        phase: card.phase,
        description: card.description,
        direction: pattern.direction,
        offset: pattern.offset,
        strength: pattern.strength,
      };
      resolveThreat(G, random, synthetic);
    }
  }

  // The win flag fires whether or not the village still has buildings —
  // surviving the boss's printed attacks is the win condition (D26).
  G.bossResolved = true;
  // Snapshot the round at which the win latched; the persistence hook
  // (10.7 / future score recording) reads this even if `G.round`
  // advances before `endIf` is re-checked.
  G.turnsAtWin = G.round;
};
