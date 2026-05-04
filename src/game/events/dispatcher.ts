// 08.2 — Event-effect dispatcher.
//
// Iterates the effects on an `EventCardDef`, casts each entry to the typed
// `EventEffect` union (08.2), and applies them per kind. New effect kinds
// must be added both to `EventEffect` (effects.ts) and here so unknown
// content surfaces immediately as a thrown "unknown effect kind: ..."
// error rather than a silent no-op.
//
// Effects fall into three buckets, mirrored in the switch below:
//   - Immediate / deterministic: mutate G in place.
//   - Modifier: push onto `G._modifiers`. The move that's conditioned by
//     the modifier is responsible for `hasModifierActive` /
//     `consumeModifier` at its own call site.
//   - Awaiting-input: stash on `G._awaitingInput[playerID]` and enter the
//     `playingEvent` stage. The follow-up `eventResolve(payload)` move
//     (08.3 / `resolveMove.ts`) feeds the payload back to apply the
//     effect.
//
// The `payload` argument is reserved for the awaiting-input flow: the
// initial dispatch (called from a `play*Event` move) ignores it; the
// follow-up dispatch from `eventResolve` passes the resolved-input data.

import type { SettlementState, PlayerID } from '../types.ts';
import type { RandomAPI } from '../random.ts';
import type { EventCardDef, EventColor } from './state.ts';
import type { EventEffect } from './effects.ts';
import { EVENT_CARDS } from '../../data/events.ts';
import { RESOURCES, type ResourceBag } from '../resources/types.ts';
import { appendBankLog } from '../resources/bankLog.ts';
import { seatOfRole } from '../roles.ts';
import {
  enterEventStage,
  STAGES,
  type StageEvents,
  type StageName,
} from '../phases/stages.ts';

// Color → role mapping. Mirrors the constant in `events/state.ts` but kept
// local so the dispatcher doesn't reach into a private const there. Used
// by `gainResource` with `target: 'stash'` to find which seat's mat to
// credit.
const COLOR_TO_ROLE = {
  gold: 'chief',
  blue: 'science',
  green: 'domestic',
  red: 'defense',
} as const;

const addToBag = (
  bag: ResourceBag,
  amounts: Partial<ResourceBag>,
): void => {
  for (const r of RESOURCES) {
    const amt = amounts[r] ?? 0;
    if (amt === 0) continue;
    bag[r] += amt;
  }
};

/**
 * Apply each effect on `card` to `G`. The `playerID` argument is needed
 * for the awaiting-input flow (the dispatcher records *who* must
 * resolve the follow-up). Stash credits use the seat that holds the
 * matching role for the card's color, NOT `playerID` — the chief plays
 * a blue card via a tech effect doesn't credit the chief's mat.
 *
 * `events` is bgio's `Events` API (typed loosely as `StageEvents` here
 * because we only need `setStage`). It's optional so headless tests can
 * call `dispatch` without booting a full client; effects that need it
 * (the awaiting-input flow) gracefully no-op the stage transition when
 * `events` is undefined and rely on the `_awaitingInput` slot to be
 * observed directly.
 */
export const dispatch = (
  G: SettlementState,
  ctx: unknown,
  random: RandomAPI,
  card: EventCardDef,
  payload?: unknown,
  context?: {
    playerID?: PlayerID;
    events?: StageEvents;
    // Stage to push onto the per-seat stack before transitioning into
    // `playingEvent` — typically the seat's current stage read from
    // `ctx.activePlayers?.[playerID]`. Required for the awaiting-input
    // flow's stage transition; unused otherwise.
    returnTo?: StageName;
  },
): void => {
  void ctx;
  void random;

  const effects = card.effects as EventEffect[];

  for (const effect of effects) {
    switch (effect.kind) {
      case 'gainResource': {
        if (effect.target === 'bank') {
          addToBag(G.bank, effect.bag);
          appendBankLog(G, 'eventCard', effect.bag, `Event ${card.id}`);
          break;
        }
        // 'stash': credit the seat that holds the role mapping to this
        // card's color. The chief seat has no mat, so a gold-card
        // stash effect intentionally no-ops (chief acts on the bank
        // directly — see types.ts on the mats map).
        const role = COLOR_TO_ROLE[card.color];
        const seat = (() => {
          try {
            return seatOfRole(G.roleAssignments, role);
          } catch {
            return null;
          }
        })();
        if (seat === null) break;
        const mat = G.mats?.[seat];
        if (mat === undefined) break;
        addToBag(mat.stash, effect.bag);
        break;
      }

      case 'addEventCard': {
        const def = EVENT_CARDS.find((c) => c.id === effect.cardID);
        if (def === undefined) {
          throw new Error(
            `dispatch: addEventCard references unknown card id '${effect.cardID}'`,
          );
        }
        // Append into the matching color deck. `decks[color]` is the
        // master cycle-reset pool — see events/state.ts.
        G.events?.decks[def.color as EventColor].push(def);
        break;
      }

      case 'doubleScience':
      case 'forbidBuy':
      case 'forceCheapestScience': {
        // Modifier: queue for the next conditioned move to consume.
        if (G._modifiers === undefined) G._modifiers = [];
        G._modifiers.push(effect);
        break;
      }

      case 'swapTwoScienceCards':
      case 'awaitInput': {
        const seat = context?.playerID;
        if (seat === undefined) {
          // Without a seat we can't park the awaiting-input slot. This
          // is a programming error: every play*Event move passes its
          // own playerID, so reaching here means the dispatcher was
          // called from an unexpected code path.
          throw new Error(
            `dispatch: '${effect.kind}' requires a playerID context`,
          );
        }
        if (G._awaitingInput === undefined) G._awaitingInput = {};
        G._awaitingInput[seat] = effect;
        // Drive the seat into `playingEvent`. The caller passes the
        // current stage as `context.returnTo` (typically read from
        // `ctx.activePlayers?.[playerID]`) so `exitEventStage` can pop
        // back to it after the resolve. Skipping the stage transition
        // when `events` is unset (e.g. in headless dispatcher tests)
        // keeps the unit tests usable; `_awaitingInput` is the
        // load-bearing observation in that case.
        if (context?.events !== undefined && context.returnTo !== undefined) {
          enterEventStage(G, seat, context.events, context.returnTo);
        } else if (context?.events !== undefined) {
          // No explicit returnTo — push the current playing-event slot
          // anyway so the stack pop has something to land on. We use
          // `playingEvent` itself as a sentinel, which is harmless here
          // because the resolve move pops back without re-checking the
          // returned stage value.
          enterEventStage(G, seat, context.events, STAGES.playingEvent);
        }
        break;
      }

      default: {
        // Exhaustiveness: TypeScript should already complain if a new
        // kind is added to `EventEffect` without a case here, but a
        // runtime throw also catches JSON content drift (effects in
        // events.json with a `kind` field this code doesn't handle).
        const exhaustive: never = effect;
        throw new Error(
          `dispatch: unknown effect kind: ${(exhaustive as { kind?: string }).kind ?? 'unspecified'}`,
        );
      }
    }
  }

  // Hand over the optional `payload` for the awaiting-input flow's
  // *follow-up* dispatch — `eventResolve` synthesizes a card whose
  // single effect carries the kind to apply, and threads `payload`
  // through here. Right now the only payload-aware kind is the swap;
  // the application itself lives in `resolveMove.ts` so this dispatcher
  // stays agnostic to higher-level move shape.
  void payload;
};

/**
 * Returns whether a modifier with `kind` is queued on `G._modifiers`.
 * Other modules call this rather than reaching into `_modifiers`
 * directly so a future shape change (e.g. a Map keyed by kind) only has
 * to be reflected here.
 */
export const hasModifierActive = (
  G: SettlementState,
  kind: EventEffect['kind'],
): boolean => {
  const stack = G._modifiers;
  if (stack === undefined) return false;
  return stack.some((m) => m.kind === kind);
};

/**
 * Removes the *first* modifier of `kind` from `G._modifiers`. No-op if
 * absent. Mirrors `hasModifierActive`'s read behavior so each modifier
 * is consumed exactly once per matching move.
 */
export const consumeModifier = (
  G: SettlementState,
  kind: EventEffect['kind'],
): void => {
  const stack = G._modifiers;
  if (stack === undefined) return;
  const idx = stack.findIndex((m) => m.kind === kind);
  if (idx >= 0) stack.splice(idx, 1);
};
