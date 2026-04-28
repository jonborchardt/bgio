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
//
// On success: dispatches the tech's `onPlayEffects` via 08.2's dispatcher.
// V1: leaves the card in the hand (the passive stays, only `onPlay` is
// one-shot). If single-use techs become a thing later, this is where to
// drop the card from the hand.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState, Role } from '../types.ts';
import type { TechnologyDef } from '../../data/schema.ts';
import { rolesAtSeat } from '../roles.ts';
import { fromBgio, type BgioRandomLike } from '../random.ts';
import { applyTechOnPlay } from './effects.ts';
import type { StageEvents, StageName } from '../phases/stages.ts';

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

    // Must have non-empty onPlayEffects to play.
    if (
      tech.onPlayEffects === undefined ||
      tech.onPlayEffects.length === 0
    ) {
      return INVALID_MOVE;
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
  };
};
