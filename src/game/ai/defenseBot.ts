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
  // Fall through to seat-done (always present) so the round advances.
  return candidates.find((c) => c.move === 'defenseSeatDone') ?? null;
};

export const defenseBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
