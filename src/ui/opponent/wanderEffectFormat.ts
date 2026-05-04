// Shared helpers for the wander system's `EventEffect` shapes. Two
// consumers — WanderCard (full presentational card) and WanderEffectRow
// (one-line panel header) — both render the same `gainResource` bags and
// modifier rule-text. Centralizing keeps the two surfaces in lockstep
// when content changes.
//
// The matching `GainResourceTokens` component lives in its own file so
// this module can stay JSX-free.

import type { EventEffect } from '../../game/events/effects.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';

type GainEffect = Extract<EventEffect, { kind: 'gainResource' }>;

export const isGain = (e: EventEffect): e is GainEffect =>
  e.kind === 'gainResource';

export const bagResources = (bag: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) if ((bag[r] ?? 0) > 0) out.push(r);
  return out;
};

/** One-line natural-language summary for the modifier / one-shot effect
 *  kinds. Returns null for `gainResource`/`awaitInput`/`swapTwoScienceCards`,
 *  which are rendered with token rows or have no surface at all. */
export const ruleText = (effect: EventEffect): string | null => {
  switch (effect.kind) {
    case 'doubleScience':
      return 'Science pays 2× this round.';
    case 'forbidBuy':
      return 'Science cannot complete a card this round.';
    case 'forceCheapestScience':
      return 'Science must pursue its cheapest option this round.';
    case 'addEventCard':
      return `Adds event card "${effect.cardID}" to its color deck.`;
    case 'swapTwoScienceCards':
    case 'awaitInput':
    case 'gainResource':
      return null;
  }
};
