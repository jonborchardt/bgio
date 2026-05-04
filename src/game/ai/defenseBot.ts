// 1.4 — DefenseBot stub.
//
// Phase 2 will fill this in once the new defense card economy lands. For
// 1.4 the bot just ends the seat's turn — there are no buy / place /
// play-tech actions to take, and parking on `defenseTurn` would deadlock
// the round.
//
// Mirrors the per-role bot contract from 11.3-11.6 so `buildBotMap`
// (lobby/soloConfig.ts) can compose it alongside chiefBot / scienceBot /
// domesticBot.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import type { MoveCandidate } from './enumerate.ts';

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
  // 1.4 stub: end the turn so the round can advance. Phase 2 will replace
  // this with real heuristics (buy / place / play-tech).
  return { move: 'defenseSeatDone', args: [] };
};

export const defenseBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
