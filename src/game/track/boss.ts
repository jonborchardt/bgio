// Defense redesign 2.7 — boss resolution.
//
// The boss is the unique, terminal card on the Global Event Track (D21).
// When it flips, two printed thresholds are checked against the live
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
//   - `science`: count of Library cards bought across every seat's
//     discount tableau, via `countLibraryCardsBought` reading
//     `G.library.discountTableaus` (the canonical "how many things have
//     we researched" roster after the Library redesign).
//   - `economy`: running maximum of bank gold (`G.economyHigh`), so a
//     chief who briefly stockpiles can't lose the threshold by spending
//     afterwards.
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
import {
  aggregateLibraryDebuffs,
  totalDebuffReduction,
} from '../library/debuff.ts';

/** Count Library cards bought. Sums the per-seat discount tableaus —
 *  every Library buy pushes the bought card onto the buyer's tableau, so
 *  the total length across seats is the canonical "how many things have
 *  we researched" reading. Returns 0 when the library slice is absent so
 *  older fixtures don't crash the threshold check. */
export const countLibraryCardsBought = (G: SettlementState): number => {
  const lib = G.library;
  if (lib === undefined) return 0;
  let n = 0;
  for (const seat of Object.keys(lib.discountTableaus)) {
    n += lib.discountTableaus[seat]?.length ?? 0;
  }
  return n;
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
  if (countLibraryCardsBought(G) >= card.thresholds.science) met += 1;
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

  // SL 4 — sum the library debuff levels across all four colors. The V1
  // default (master plan #1) applies the total as a flat reduction on
  // every attack's strength, floored at 0. A 5-gold + 5-blue tableau
  // therefore knocks 2 off each attack.
  const debuffReduction = totalDebuffReduction(aggregateLibraryDebuffs(G));

  // Defensive: an empty attackPattern means we have no shape to feed
  // resolveThreat. The 2.1 schema loader already rejects empty patterns,
  // so this branch only protects synthetic test fixtures.
  if (attacks > 0 && card.attackPattern.length > 0) {
    for (let i = 0; i < attacks; i += 1) {
      const pattern = card.attackPattern[i % card.attackPattern.length];
      if (pattern === undefined) continue;
      const reducedStrength = Math.max(0, pattern.strength - debuffReduction);
      const synthetic: ThreatCard = {
        kind: 'threat',
        id: `${card.id}-attack-${i + 1}`,
        name: `${card.name} (attack ${i + 1})`,
        phase: card.phase,
        description: card.description,
        direction: pattern.direction,
        offset: pattern.offset,
        strength: reducedStrength,
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
