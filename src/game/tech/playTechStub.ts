// 08.6 — Shared "play one tech card of <role>" factory.
//
// Each of the four `<role>PlayTech` moves (chief / science / domestic /
// foreign) only differs in (role, hand-slot accessor). Centralizing the
// validation + dispatch loop keeps the four moves in lockstep.
//
// Validations (in order):
//   1. caller has a defined playerID
//   2. caller holds `role`
//   3. the seat's tech-card hand exists and contains a card whose id
//      (resolved as `tech.name`, since `TechnologyDef` carries no `id`
//      field — the canonical handle is the unique `name`) matches
//      `cardID`
//   4. the located tech has a non-empty `onPlayEffects`
//   5. the seat can afford the tech's `costBag` (free if absent/empty).
//      Chief debits `G.bank`; everyone else debits `mats[seat].stash`.
//
// On success: spends the cost, then dispatches the tech's `onPlayEffects`
// via 08.2's dispatcher. V1: leaves the card in the hand (the passive
// stays, only `onPlay` is one-shot). If single-use techs become a thing
// later, this is where to drop the card from the hand.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState, Role } from '../types.ts';
import type { TechnologyDef } from '../../data/schema.ts';
import { rolesAtSeat } from '../roles.ts';
import { fromBgio, type BgioRandomLike } from '../random.ts';
import { applyTechOnPlay } from './effects.ts';
import type { StageEvents, StageName } from '../phases/stages.ts';
import { canAfford } from '../resources/bag.ts';
import { transfer } from '../resources/bank.ts';
import { appendBankLog, negateBag } from '../resources/bankLog.ts';
import { payFromStash } from '../resources/moves.ts';
import type { ResourceBag } from '../resources/types.ts';
import { pushGraveyard } from '../graveyard.ts';
import { idForTech } from '../../cards/registry.ts';

/**
 * Each role looks up its tech-card hand differently. We pass the
 * accessor in instead of branching on `role` so the factory stays a
 * straight pipeline.
 */
type TechHandAccessor = (G: SettlementState) => TechnologyDef[] | undefined;

export const playTechStub = (
  role: Role,
  getHand: TechHandAccessor,
): Move<SettlementState> => {
  return ({ G, ctx, playerID, random, events }, cardID: string) => {
    if (playerID === undefined || playerID === null) return INVALID_MOVE;

    if (!rolesAtSeat(G.roleAssignments, playerID).includes(role)) {
      return INVALID_MOVE;
    }

    const hand = getHand(G);
    if (hand === undefined) return INVALID_MOVE;

    // `TechnologyDef` doesn't carry an `id` field — the unique handle
    // we expose to clients is `name`. The PlayTech moves accept a
    // `cardID: string` per the 08.6 plan API; we match it against
    // `name` here. (If `TechnologyDef` later gains an `id` field, the
    // lookup should switch to that.)
    const tech = hand.find((t) => t.name === cardID);
    if (tech === undefined) return INVALID_MOVE;

    // Every tech can be played — even the ones whose only value is the
    // text-only per-color event reactions (Compass et al). Playing
    // always charges the cost and consumes the card; if there's no
    // engine-level effect to dispatch, the player still gets the
    // visible "card resolved and went away" feedback they expect after
    // clicking. (We used to gate on `onPlayEffects` or named unlocks
    // and silently INVALID_MOVE the rest, which made cards like Compass
    // appear broken.)

    // Cost gate. `costBag` is optional/partial; treat absent as free.
    const cost = tech.costBag ?? {};
    const costNonEmpty = Object.values(cost).some((v) => (v ?? 0) > 0);
    if (costNonEmpty) {
      if (role === 'chief') {
        // Chief spends from the bank directly (no mat). canAfford requires
        // a full ResourceBag on the `have` side, so use `G.bank` as-is.
        if (!canAfford(G.bank, cost)) return INVALID_MOVE;
        // Debit bank into a throwaway sink so we keep the same `transfer`
        // accounting (`transfer` mutates both sides). We then log the
        // signed delta so the chief tooltip reflects the spend.
        const sink: ResourceBag = {
          gold: 0, wood: 0, stone: 0, steel: 0, horse: 0,
          food: 0, production: 0, science: 0, happiness: 0, worker: 0,
        };
        transfer(G.bank, sink, cost);
        appendBankLog(G, 'stashPayment', negateBag(cost), `chief play tech ${tech.name}`);
      } else {
        const mat = G.mats?.[playerID];
        if (mat === undefined || !canAfford(mat.stash, cost)) {
          return INVALID_MOVE;
        }
        try {
          payFromStash(G, playerID, cost);
        } catch {
          return INVALID_MOVE;
        }
      }
    }

    // All checks passed — dispatch.
    const fallbackRandom: BgioRandomLike = {
      Shuffle: <T>(arr: T[]): T[] => [...arr],
      Number: () => 0,
    };
    const r = fromBgio((random as BgioRandomLike | undefined) ?? fallbackRandom);

    const returnTo = (
      ctx as unknown as { activePlayers?: Record<string, string> }
    )?.activePlayers?.[playerID];

    applyTechOnPlay(G, ctx, r, playerID, tech, {
      events: events as StageEvents | undefined,
      returnTo: returnTo as StageName | undefined,
    });

    // Played → consumed. Remove the card from the hand we located it in.
    // Passive effects don't survive past the play; if a future content
    // pass needs "card stays after play (passive remains)" we'll add an
    // opt-in `keepInHand` flag on TechnologyDef and gate the splice on it.
    const idx = hand.findIndex((t) => t.name === cardID);
    if (idx >= 0) hand.splice(idx, 1);

    // Log the play in the seat's graveyard so the "what have you
    // played?" panel can list it. Public state — visible to every seat.
    pushGraveyard(G, playerID, {
      cardId: idForTech(tech),
      kind: 'tech',
      name: tech.name,
    });
  };
};
