// 08.6 — Tech-card effect glue.
//
// Tech cards carry three optional effect lists (per 08.6's `TechEffect`
// interface): `onAcquire` (fired once at distribution time by 05.3's
// `scienceComplete`), `onPlay` (fired by `<role>PlayTech` when the
// holder explicitly plays it), and `passive` (read by `techPassives` so
// the modifier pipeline can layer per-card bonuses on top of dispatched
// effects).
//
// The effect taxonomy is shared with event cards (the 08.2 `EventEffect`
// union) — no new kinds are introduced unless content genuinely demands
// it. `dispatch` from `events/dispatcher.ts` is the single application
// path; we just feed it a synthetic `EventCardDef` whose `effects`
// array is the tech's `onAcquire` / `onPlay` list.
//
// `passiveEffects` aren't dispatched directly (they're not "applied" —
// they're queried). The pipeline reads them via `techPassives(G, holder)`
// and decides per-call whether they apply.

import type { SettlementState, PlayerID } from '../types.ts';
import type { TechnologyDef } from '../../data/schema.ts';
import type { RandomAPI } from '../random.ts';
import type { EventCardDef, EventColor } from '../events/state.ts';
import type { EventEffect } from '../events/effects.ts';
import { dispatch } from '../events/dispatcher.ts';
import type { StageEvents, StageName } from '../phases/stages.ts';

/**
 * Public-facing shape per the 08.6 plan. Tech-card content mostly lives
 * on `TechnologyDef` directly (the optional 08.6 fields), but a parallel
 * struct lets module callers pass effect bundles around without naming
 * `TechnologyDef` everywhere.
 */
export interface TechEffect {
  passive?: EventEffect[];
  onAcquire?: EventEffect[];
  onPlay?: EventEffect[];
}

/**
 * Adapt a `TechnologyDef` + an effects list into a synthetic
 * `EventCardDef` so the existing 08.2 dispatcher can apply it.
 *
 * The synthetic `color` field is `'gold'` — chosen arbitrarily because
 * tech cards have no intrinsic color (the science-card color decides
 * where the tech is *delivered*, not what role it then belongs to).
 * Effect kinds that consult `card.color` are `gainResource.stash` and
 * `addEventCard`; if a tech's effects use either, the destination is
 * fixed to the chief seat's mat / the gold deck via this synthetic.
 * Author content accordingly, or thread an explicit `target` on the
 * effect (see 08.2 dispatcher).
 */
const techAsEventCard = (
  tech: TechnologyDef,
  effects: unknown[],
): EventCardDef => ({
  id: `tech:${tech.name}`,
  color: 'gold' satisfies EventColor,
  name: tech.name,
  effects,
});

/**
 * Apply the `onAcquireEffects` of `tech` to `G`. No-op when the tech
 * has no acquire effects (V1 most don't). `holder` is the seat that
 * just received the card — surfaced as `playerID` to the dispatcher
 * so any awaiting-input effects park on the right slot.
 *
 * The `context` argument is reserved for the awaiting-input flow's
 * stage transition (the dispatcher's optional `events` + `returnTo`
 * fields). 05.3 calls into here from inside the science completion
 * move — bgio's `events` plugin and the seat's stage are still in
 * scope at that call site, so completion can wire them through. For
 * tests / call sites without bgio, `context` is `{}` and any
 * awaiting-input effects record on `G._awaitingInput[holder]` without
 * the stage push (per dispatcher contract).
 */
export const applyTechOnAcquire = (
  G: SettlementState,
  ctx: unknown,
  random: RandomAPI,
  holder: PlayerID,
  tech: TechnologyDef,
  context?: { events?: StageEvents; returnTo?: StageName },
): void => {
  const effects = tech.onAcquireEffects;
  if (effects === undefined || effects.length === 0) return;
  const card = techAsEventCard(tech, effects);
  dispatch(G, ctx, random, card, undefined, {
    playerID: holder,
    events: context?.events,
    returnTo: context?.returnTo,
  });
};

/**
 * Apply the `onPlayEffects` of `tech` to `G`. Mirrors
 * `applyTechOnAcquire` but for the player-driven `<role>PlayTech`
 * moves. Returns `true` iff there was something to dispatch; the
 * play moves use this so they can cleanly INVALID_MOVE on a tech
 * with no `onPlayEffects`.
 */
export const applyTechOnPlay = (
  G: SettlementState,
  ctx: unknown,
  random: RandomAPI,
  holder: PlayerID,
  tech: TechnologyDef,
  context?: { events?: StageEvents; returnTo?: StageName },
): boolean => {
  const effects = tech.onPlayEffects;
  if (effects === undefined || effects.length === 0) return false;
  const card = techAsEventCard(tech, effects);
  dispatch(G, ctx, random, card, undefined, {
    playerID: holder,
    events: context?.events,
    returnTo: context?.returnTo,
  });
  return true;
};

/**
 * Walk every tech-card hand owned by `holder` (across the four role
 * slots) and concat their `passiveEffects` into a single list.
 *
 * Today the four hands are:
 *   - `G.chief.hand`     — gold-distributed techs (05.3)
 *   - `G.science.hand`   — blue-distributed techs (05.3)
 *   - `G.domestic.techHand` — green-distributed techs (05.3)
 *   - `G.foreign.hand`   — red-distributed techs (07.4 / 05.3, plus
 *                          starter UnitDef entries from 07.2 — the
 *                          slot is mixed-typed today; we filter for
 *                          entries that look like tech defs by
 *                          presence of the `branch` field).
 *
 * `holder` here is the seat — we resolve which roles that seat holds
 * via the role-assignment table on `G` and concat from the matching
 * slots only. Seats that don't hold a role contribute nothing for
 * that role's hand.
 *
 * Returns a fresh array; caller may freely mutate.
 */
export const techPassives = (
  G: SettlementState,
  holder: PlayerID,
): EventEffect[] => {
  const roles = G.roleAssignments[holder];
  if (roles === undefined) return [];
  const out: EventEffect[] = [];

  const collect = (techs: ReadonlyArray<TechnologyDef> | undefined): void => {
    if (techs === undefined) return;
    for (const tech of techs) {
      const passive = tech.passiveEffects;
      if (passive === undefined || passive.length === 0) continue;
      for (const eff of passive) out.push(eff as EventEffect);
    }
  };

  if (roles.includes('chief')) collect(G.chief?.hand);
  if (roles.includes('science')) collect(G.science?.hand);
  if (roles.includes('domestic')) collect(G.domestic?.techHand);
  if (roles.includes('foreign')) {
    // ForeignState.hand is mixed-typed today: starter entries are
    // UnitDef (no `branch`) and 05.3 distribution adds TechnologyDef
    // (with `branch`). Filter to tech-shaped entries only — see the
    // module-level note above and the 07.4 plan's eventual hand-
    // type refactor. TypeScript can't structurally narrow `UnitDef`
    // (which lacks `branch`) to `TechnologyDef`, so we route through
    // `unknown` to strip the source-side type before the predicate.
    const foreignHand = G.foreign?.hand;
    if (foreignHand !== undefined) {
      const techsOnly = (foreignHand as unknown as unknown[]).filter(
        (e): e is TechnologyDef =>
          typeof (e as { branch?: unknown }).branch === 'string',
      );
      collect(techsOnly);
    }
  }

  return out;
};
