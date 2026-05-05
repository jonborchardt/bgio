// Defense redesign 2.5 — `defensePlay` move (red-tech card play).
//
// Red tech cards live on `G.defense.techHand` (distributed by 05.3's
// `scienceComplete`). Per spec D24 they fall into two flavours:
//
//   1. **Unit-upgrade techs** — target a unit instance in `inPlay` and
//      grant a durable `taughtSkill` from the V1 skill table
//      (`extendRange`, `sharpen`, `firstStrike`, etc; the resolver in
//      2.3 already reads these at fire time).
//   2. **Track-modifier techs** — mutate `G.track.upcoming`:
//        - `peek` (N): mark the next N upcoming cards as revealed (UI
//          flag only — `G.track.upcoming` is already public per
//          playerView).
//        - `swap`: swap two cards within the same phase pile in
//          `upcoming` (caller picks indices via `args`).
//        - `demote`: replace the next card with one from the previous
//          phase's history (cards that already flipped). The replaced
//          card moves into history.
//
// New `onPlayEffects` kinds are recognized below. Legacy kinds
// (`gainResource`, `addEventCard`, …) fall through to the existing
// 08.6 `applyTechOnPlay` path so red techs that author bank-credit
// effects continue to work.
//
// Validations (in order):
//   1. caller has a defined playerID, holds `defense`, is in
//      stage `defenseTurn`,
//   2. `techDefID` resolves in `G.defense.techHand` and `onPlayEffects`
//      is non-empty (the play has *something* to do),
//   3. when `args.kind === 'unitUpgrade'`: the target unit is in play
//      and the named skill is one of the V1 skills,
//   4. when `args.kind === 'swap'`: both indices are inside the same
//      phase pile in `upcoming`,
//   5. when `args.kind === 'demote'`: there is at least one previously-
//      flipped card and at least one upcoming card.
//
// On success: snapshot for undo, apply effects, splice the tech out of
// `techHand` (single-use card), graveyard the play.
//
// Cost: defense plays the card free of resource cost (per the plan's
// sub-phase note "tech cards usually cost the science seat's
// contribution already"). The tech's `costBag`, if present, is ignored
// by this move — the science seat already paid for it during
// `scienceContribute` / `scienceComplete`.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import type { TechnologyDef } from '../../../data/schema.ts';
import { rolesAtSeat } from '../../roles.ts';
import { fromBgio, type BgioRandomLike } from '../../random.ts';
import { applyTechOnPlay } from '../../tech/effects.ts';
import { pushGraveyard } from '../../graveyard.ts';
import { idForTech } from '../../../cards/registry.ts';
import { markUndoable } from '../../undo.ts';
import { clearRequestsForTarget } from '../../requests/clear.ts';
import {
  applyDefenseRedEffect,
  isDefenseRedEffect,
  type DefenseRedEffect,
  type DefensePlayArgs,
} from './redTechEffects.ts';

export const defensePlay: Move<SettlementState> = (
  { G, ctx, playerID, random, events },
  techDefID: string,
  args?: DefensePlayArgs,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('defense')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'defenseTurn') return INVALID_MOVE;

  const defense = G.defense;
  if (defense === undefined) return INVALID_MOVE;
  const techHand = defense.techHand;
  if (techHand === undefined) return INVALID_MOVE;

  if (typeof techDefID !== 'string' || techDefID.length === 0) {
    return INVALID_MOVE;
  }
  const tech: TechnologyDef | undefined = techHand.find(
    (t) => t.name === techDefID,
  );
  if (tech === undefined) return INVALID_MOVE;

  // Every red tech can be played — even ones whose only value is a
  // text-field unit/building unlock (e.g. Sharpshooting, Animals).
  // Mirrors the loosened gate on the shared playTechStub.
  const effects = tech.onPlayEffects ?? [];

  // Split the effect list into defense-specific entries (handled inline)
  // and "everything else" (delegated to applyTechOnPlay below). We
  // pre-validate the defense-specific entries first so the move can
  // reject before mutating G when args don't match.
  const defenseEffects: DefenseRedEffect[] = [];
  for (const effect of effects) {
    if (isDefenseRedEffect(effect)) defenseEffects.push(effect);
  }

  // For each defense-specific effect, run a precheck so we can bail
  // before mutation. We keep the precheck side-by-side with the apply
  // path so the validation logic doesn't drift.
  for (const effect of defenseEffects) {
    if (!precheckDefenseRedEffect(G, effect, args)) return INVALID_MOVE;
  }

  // Snapshot for undo before any mutation.
  markUndoable(G, `Play ${tech.name}`, playerID);

  // Apply defense-specific effects first (they're targeted operations
  // that the seat picked args for).
  for (const effect of defenseEffects) {
    applyDefenseRedEffect(G, effect, args);
  }

  // Then dispatch any non-defense-specific effects via the existing
  // tech-on-play path. We only call through when at least one effect
  // would actually go through — otherwise applyTechOnPlay would still
  // try to grant unit / building unlocks named on the tech, which is a
  // legitimate side-effect (e.g., a red tech that unlocks a Watchtower).
  const fallbackRandom: BgioRandomLike = {
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
  };
  const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);
  // Filter the tech's effect list to the non-defense-specific entries so
  // the dispatcher only sees what it knows how to handle. We synthesize
  // a shallow-cloned tech to hand to applyTechOnPlay (mutation-safe).
  const passthroughEffects = effects.filter((e) => !isDefenseRedEffect(e));
  if (passthroughEffects.length > 0 || hasTextUnlocks(tech)) {
    const clone: TechnologyDef = { ...tech, onPlayEffects: passthroughEffects };
    // events / returnTo are best-effort; the dispatcher gracefully no-
    // ops when they're missing.
    const returnTo = (
      ctx as unknown as { activePlayers?: Record<string, string> }
    )?.activePlayers?.[playerID];
    applyTechOnPlay(G, ctx, r, playerID, clone, {
      events: events as
        | import('../../phases/stages.ts').StageEvents
        | undefined,
      returnTo: returnTo as
        | import('../../phases/stages.ts').StageName
        | undefined,
    });
  }

  // Played → consumed. Single-use red tech card.
  const idx = techHand.findIndex((t) => t.name === techDefID);
  if (idx >= 0) techHand.splice(idx, 1);

  pushGraveyard(G, playerID, {
    cardId: idForTech(tech),
    kind: 'tech',
    name: tech.name,
  });
  clearRequestsForTarget(G, idForTech(tech));
};

/**
 * Light precheck so the move can reject without mutating G when the
 * caller's `args` don't satisfy the targeted effect's requirements.
 * Kept in lockstep with `applyDefenseRedEffect` in
 * `./redTechEffects.ts`.
 */
const precheckDefenseRedEffect = (
  G: SettlementState,
  effect: DefenseRedEffect,
  args: DefensePlayArgs | undefined,
): boolean => {
  switch (effect.kind) {
    case 'unitUpgrade': {
      if (args?.kind !== 'unitUpgrade') return false;
      const inPlay = G.defense?.inPlay ?? [];
      const target = inPlay.find((u) => u.id === args.unitInstanceID);
      if (target === undefined) return false;
      // V1 skills — match the resolver's known set in track/resolver.ts.
      const known = new Set([
        'extendRange',
        'reinforce',
        'accelerate',
        'sharpen',
        'firstStrike',
      ]);
      const skill = effect.skill ?? args.skill;
      if (skill === undefined || !known.has(skill)) return false;
      return true;
    }
    case 'peekTrack': {
      // Always legal — the upcoming list is already public; this just
      // marks card ids as "peeked" for UI hinting. Empty upcoming → no-
      // op rather than reject so the move feels predictable.
      return G.track !== undefined;
    }
    case 'swapTrackInPhase': {
      if (args?.kind !== 'swap') return false;
      const upcoming = G.track?.upcoming;
      if (upcoming === undefined) return false;
      const a = args.indexA;
      const b = args.indexB;
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a === b ||
        a < 0 ||
        b < 0 ||
        a >= upcoming.length ||
        b >= upcoming.length
      ) {
        return false;
      }
      // Both indices must reference the same phase pile.
      if (upcoming[a]!.phase !== upcoming[b]!.phase) return false;
      return true;
    }
    case 'demoteTrack': {
      const upcoming = G.track?.upcoming ?? [];
      const history = G.track?.history ?? [];
      if (upcoming.length === 0) return false;
      // Need at least one previously-flipped card to swap in.
      if (history.length === 0) return false;
      return true;
    }
  }
};

/** True if the tech card text-fields name any unlock targets the
 *  on-play path should grant. Mirrors the gating in
 *  `applyTechOnPlay`'s grantTechUnlocks helper. Kept here so we can
 *  short-circuit the dispatcher call when there's nothing to do. */
const hasTextUnlocks = (tech: TechnologyDef): boolean => {
  const a = (tech.buildings ?? '').trim();
  const b = (tech.units ?? '').trim();
  return a.length > 0 || b.length > 0;
};
