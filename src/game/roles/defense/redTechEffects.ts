// Defense redesign 2.5 — defense-specific red-tech effect taxonomy.
//
// `TechnologyDef.onPlayEffects` is loaded as `unknown[]` by the schema
// (see `src/data/schema.ts`), so this module recognizes new `kind`
// strings without forcing a JSON migration. The 08.6 dispatcher only
// understands the `EventEffect` union; defense-specific kinds are
// peeled off the effect list by `defensePlay` and routed through
// `applyDefenseRedEffect` instead.
//
// Effect kinds (D24):
//   - `unitUpgrade`:  attaches a taught skill to a target unit
//                     instance. The skill ID may be authored on the
//                     tech (`effect.skill`) or supplied at play time
//                     (`args.skill`). Skill IDs match the V1 list the
//                     combat resolver in `track/resolver.ts` already
//                     reads (`extendRange`, `sharpen`, `firstStrike`,
//                     plus `reinforce` / `accelerate` for the future
//                     Phase 2.6 science Teach move).
//   - `peekTrack`:    reveals the next N upcoming track cards by
//                     pushing their ids onto `G.defense._peeked`.
//                     `G.track.upcoming` is already public (see
//                     `playerView`) so the marker is purely UI hinting.
//   - `swapTrackInPhase`: swaps two cards within the same phase pile in
//                     `G.track.upcoming`. Caller passes the two
//                     indices via `args.indexA` / `args.indexB`.
//   - `demoteTrack`:  replaces the next upcoming card with the most
//                     recent entry from `history` (a previously-flipped
//                     card from a prior phase). Effectively "give us a
//                     card we've already seen" in lieu of a fresh
//                     phase-N card.
//
// `args` are always present-or-required per kind:
//   - unitUpgrade → `{ kind: 'unitUpgrade', unitInstanceID, skill? }`
//   - peekTrack   → no args needed (the count comes from
//                    `effect.amount`).
//   - swap        → `{ kind: 'swap', indexA, indexB }`.
//   - demote      → no args needed.
//
// `defensePlay` precheckes args before calling `applyDefenseRedEffect`,
// so callers below assume the inputs are valid.

import type { SettlementState } from '../../types.ts';
import { peekFollowing } from '../../track.ts';

export interface UnitUpgradeEffect {
  kind: 'unitUpgrade';
  /** Optional pre-baked skill id authored on the tech itself. When
   *  absent, the player picks via `args.skill`. */
  skill?: string;
}

export interface PeekTrackEffect {
  kind: 'peekTrack';
  /** How many of the next upcoming cards to mark peeked. Defaults to 1
   *  when absent. */
  amount?: number;
}

export interface SwapTrackInPhaseEffect {
  kind: 'swapTrackInPhase';
}

export interface DemoteTrackEffect {
  kind: 'demoteTrack';
}

export type DefenseRedEffect =
  | UnitUpgradeEffect
  | PeekTrackEffect
  | SwapTrackInPhaseEffect
  | DemoteTrackEffect;

/** Caller-supplied targeting payload, discriminated by `kind`. */
export type DefensePlayArgs =
  | { kind: 'unitUpgrade'; unitInstanceID: string; skill?: string }
  | { kind: 'swap'; indexA: number; indexB: number };

const DEFENSE_RED_KINDS: ReadonlySet<string> = new Set([
  'unitUpgrade',
  'peekTrack',
  'swapTrackInPhase',
  'demoteTrack',
]);

/** Type-guard: `unknown` effect entry → defense-specific kind. */
export const isDefenseRedEffect = (
  effect: unknown,
): effect is DefenseRedEffect => {
  if (typeof effect !== 'object' || effect === null) return false;
  const k = (effect as { kind?: unknown }).kind;
  if (typeof k !== 'string') return false;
  return DEFENSE_RED_KINDS.has(k);
};

/**
 * Apply a single defense-specific effect to G. `args` carry caller-
 * picked targeting; the move precheckes them before invoking this so
 * the apply path can be straight-line. Mutates G in place per bgio's
 * Immer convention.
 */
export const applyDefenseRedEffect = (
  G: SettlementState,
  effect: DefenseRedEffect,
  args: DefensePlayArgs | undefined,
): void => {
  switch (effect.kind) {
    case 'unitUpgrade': {
      if (args?.kind !== 'unitUpgrade') return;
      const inPlay = G.defense?.inPlay;
      if (inPlay === undefined) return;
      const target = inPlay.find((u) => u.id === args.unitInstanceID);
      if (target === undefined) return;
      const skill = effect.skill ?? args.skill;
      if (skill === undefined) return;
      if (target.taughtSkills === undefined) target.taughtSkills = [];
      // Idempotent: a duplicate teach is a no-op rather than stacking.
      if (!target.taughtSkills.includes(skill)) {
        target.taughtSkills.push(skill);
      }
      // The `reinforce` skill bumps maxHp via the resolver's stat fold,
      // but per-instance HP is the load-bearing one for stack
      // consumption. We bump current HP too so the +1 is visible
      // immediately rather than only after a regen tick.
      if (skill === 'reinforce') target.hp += 1;
      return;
    }
    case 'peekTrack': {
      if (G.track === undefined) return;
      if (G.defense === undefined) return;
      if (G.defense._peeked === undefined) G.defense._peeked = [];
      const n = Math.max(1, effect.amount ?? 1);
      const slice = peekFollowing(G.track, n);
      for (const card of slice) {
        if (!G.defense._peeked.includes(card.id)) {
          G.defense._peeked.push(card.id);
        }
      }
      return;
    }
    case 'swapTrackInPhase': {
      if (args?.kind !== 'swap') return;
      const upcoming = G.track?.upcoming;
      if (upcoming === undefined) return;
      const tmp = upcoming[args.indexA]!;
      upcoming[args.indexA] = upcoming[args.indexB]!;
      upcoming[args.indexB] = tmp;
      return;
    }
    case 'demoteTrack': {
      const track = G.track;
      if (track === undefined) return;
      if (track.upcoming.length === 0) return;
      if (track.history.length === 0) return;
      // Take the most-recent flipped card, swap it with the next
      // upcoming card. The replaced upcoming card moves into history
      // (effectively "consumed" — the demote eats a card slot).
      const replaced = track.upcoming.shift()!;
      const demoted = track.history.pop()!;
      track.upcoming.unshift(demoted);
      track.history.push(replaced);
      // Refresh the cached phase index — the new upcoming front may
      // belong to an earlier phase now.
      track.currentPhase = track.upcoming[0]?.phase ?? track.currentPhase;
      return;
    }
  }
};
