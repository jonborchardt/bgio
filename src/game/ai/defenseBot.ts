// DefenseBot — wraps the role-local enumerator from
// `src/game/roles/defense/ai.ts`.
//
// Defense redesign 2.5 — replaces the 1.4 stub. The composed bot picks
// the first non-trivial candidate (preferring buy+place / tech plays
// over `defenseSeatDone`) so a 4-bot run actually exercises the new
// move surface. Mirrors the per-role bot contract from 11.3-11.6 so
// `buildBotMap` (lobby/soloConfig.ts) composes it alongside chiefBot /
// scienceBot / domesticBot.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import type { MoveCandidate } from './enumerate.ts';
import { enumerateDefense } from '../roles/defense/ai.ts';
import { buildHelpRequestCandidate } from './botRequests.ts';
import { unitCost } from '../../data/index.ts';
import { canAfford } from '../resources/bag.ts';
import { idForUnit } from '../../cards/registry.ts';
import { RESOURCES } from '../resources/types.ts';
import type { ResourceBag } from '../resources/types.ts';

const sumResourceBag = (bag: Partial<ResourceBag>): number => {
  let total = 0;
  for (const r of RESOURCES) total += bag[r] ?? 0;
  return total;
};

export type BotAction = MoveCandidate;

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

const play = (state: BotState): BotAction | null => {
  const { G, ctx, playerID } = state;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('defense')) {
    return null;
  }
  const stage = ctx.activePlayers?.[playerID];
  if (stage !== 'defenseTurn') return null;

  const candidates = enumerateDefense(G, ctx, playerID);
  // Prefer buy+place / tech plays over seat-done so the bot exercises
  // the new move surface — only end the turn when there's nothing
  // else to do.
  const nonTrivial = candidates.filter((c) => c.move !== 'defenseSeatDone');
  if (nonTrivial.length > 0) return nonTrivial[0]!;

  // Nothing affordable — surface the cheapest unaffordable hand unit as
  // a `requestHelp` so the chief sees what we're recruiting and can
  // route bank resources. Helper dedupes per (seat, targetId) so this
  // returns null on subsequent play() calls within the same turn.
  const stash = G.mats?.[playerID]?.stash;
  const hand = G.defense?.hand ?? [];
  const sortedHand = hand
    .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined)
    .sort((a, b) => {
      const sa = sumResourceBag(unitCost(a));
      const sb = sumResourceBag(unitCost(b));
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  for (const def of sortedHand) {
    const cost = unitCost(def);
    if (stash !== undefined && canAfford(stash, cost)) continue;
    const help = buildHelpRequestCandidate({
      G,
      fromSeat: playerID,
      fromRole: 'defense',
      targetId: idForUnit(def),
      targetLabel: def.name,
      cost,
    });
    if (help !== null) return help;
    break;
  }

  // Fall through to seat-done (always present) so the round advances.
  return candidates.find((c) => c.move === 'defenseSeatDone') ?? null;
};

export const defenseBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
