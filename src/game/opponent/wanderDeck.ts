// 08.4 — Wander deck (opponent, Option 1).
//
// The "wander deck" is the V1 opponent: at each round end, the engine
// flips one wander card and applies its effects to the village. Effects
// reuse the typed `EventEffect` taxonomy from 08.2, dispatched through
// the same `events/dispatcher.ts` so any new kinds added to event cards
// also work for wander cards (and vice versa).
//
// Module-load side effect: registers the round-end hook
// `opponent:wander-step` with the 02.5 hook registry. The hook:
//   1. Pushes the previously-applied card (if any) onto `discard`.
//   2. If `deck` is empty, shuffles `discard` back into `deck` and
//      clears `discard`.
//   3. Pops the top of `deck` into `currentlyApplied`.
//   4. Dispatches the new card's effects.
//
// Hook order: this hook runs in registration order alongside the others
// (e.g. `events:reset-played-this-round`, `science:reset-completions`).
// The plan calls for "previous card's transient effects unwound before
// new card applies" — V1 doesn't track per-card duration, so the only
// "unwind" today is moving the previous `currentlyApplied` to discard.
// If/when duration metadata lands, the unwind step is the place to
// reverse modifier-stack pushes from the prior round's card.
//
// Dispatcher contract: `dispatch` takes an `EventCardDef` (which has a
// `color` field). Wander cards have no color, so we adapt by handing
// the dispatcher a synthetic card whose color is unused for the
// effects we ship today (target='bank' bypasses the color lookup;
// modifier effects ignore color entirely). If a future wander card
// uses `target: 'wallet'` or `addEventCard`, the synthetic color
// becomes load-bearing — the adapter call site documents that.

import type { Ctx } from 'boardgame.io';
import type { SettlementState } from '../types.ts';
import type { RandomAPI } from '../random.ts';
import { fromBgio } from '../random.ts';
import type { EventCardDef, EventColor } from '../events/state.ts';
import type { WanderCardDef } from '../../data/wanderCards.ts';
import { WANDER_CARDS } from '../../data/wanderCards.ts';
import { dispatch } from '../events/dispatcher.ts';
import {
  registerRoundEndHook,
  type RandomAPI as HookRandomAPI,
} from '../hooks.ts';

export type { WanderCardDef };

export interface WanderState {
  // Top of deck = next round's draw (index 0 popped via `shift`).
  deck: WanderCardDef[];
  discard: WanderCardDef[];
  currentlyApplied: WanderCardDef | null;
}

/**
 * Build the initial wander state: shuffle every wander card into the
 * deck, with empty discard and no currently-applied card. The first
 * round-end hook tick will pop the top into `currentlyApplied`.
 */
export const setupWanderDeck = (random: RandomAPI): WanderState => ({
  // `random.shuffle` returns a fresh mutable array — safe to keep on G.
  deck: random.shuffle(WANDER_CARDS),
  discard: [],
  currentlyApplied: null,
});

/**
 * Adapt a `WanderCardDef` into an `EventCardDef` so the existing 08.2
 * dispatcher can apply its effects without a parallel switch. The
 * synthetic `color` is `'gold'` — arbitrary, since the wander cards we
 * ship today only use `target: 'bank'` (which ignores color) and
 * modifier / awaiting-input effects (which also ignore color).
 */
const wanderCardAsEventCard = (card: WanderCardDef): EventCardDef => ({
  id: card.id,
  // Synthetic color slot. See module-level note: only matters for
  // effects that consult `card.color` (currently `gainResource.wallet`
  // and `addEventCard`).
  color: 'gold' satisfies EventColor,
  name: card.name,
  effects: card.effects,
});

// Round-end hook (registered at module load — idempotent under the 02.5
// hooks contract). Tests that need a clean slate must call
// `__resetHooksForTest()` and then re-import this module.
//
// The hook signature uses 02.5's `RandomAPI` shape (`Shuffle`, `Number`,
// `D6`) — the bgio random plugin shape. We adapt to this module's
// `RandomAPI` (`shuffle`, `pickOne`, `rangeInt`) via `fromBgio` so the
// dispatcher and our local helpers can use the lowercase form.
registerRoundEndHook(
  'opponent:wander-step',
  (G: SettlementState, ctx: Ctx, hookRandom: HookRandomAPI) => {
    // Guard: pre-08.4 fixtures have no `opponent` slot. No-op cleanly so
    // tests / older states don't crash the round-end sweep.
    const opponent = G.opponent;
    if (opponent === undefined || opponent.wander === undefined) return;
    const wander = opponent.wander;

    const random: RandomAPI = fromBgio(hookRandom);

    // 1. Move the previous `currentlyApplied` (if any) to discard.
    if (wander.currentlyApplied !== null) {
      wander.discard.push(wander.currentlyApplied);
      wander.currentlyApplied = null;
    }

    // 2. If the deck has emptied, reshuffle discard into deck.
    if (wander.deck.length === 0) {
      if (wander.discard.length === 0) {
        // Nothing left to draw at all — pathological (no JSON content).
        // Leave `currentlyApplied = null`; dispatch is a no-op below.
        return;
      }
      wander.deck = random.shuffle(wander.discard);
      wander.discard = [];
    }

    // 3. Pop the top of deck into currentlyApplied.
    const next = wander.deck.shift();
    if (next === undefined) return; // unreachable post-step-2; defensive.
    wander.currentlyApplied = next;

    // 4. Dispatch the new card's effects through the existing 08.2
    //    dispatcher. Wander effects never enter the awaiting-input
    //    flow today (no playerID owner for opponent draws), so we
    //    omit the `context` argument; effect kinds that require it
    //    will throw at dispatch time and surface clearly in tests.
    dispatch(G, ctx, random, wanderCardAsEventCard(next));
  },
);
