// Pure setup for the Settlement game.
//
// Returns a flat single-phase initial state. Phases, real decks, and
// per-player private hands arrive in 02.x / 03.x; until then `centerMat`
// and `hands` are empty placeholders and the bank is seeded with the
// upcoming default starter `gold: 3` (per 03.2).

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from './types.ts';
import { assignRoles } from './roles.ts';
import { bagOf } from './resources/bag.ts';

export const setup = ({ ctx }: { ctx: Ctx }): SettlementState => {
  const numPlayers = ctx.numPlayers as 1 | 2 | 3 | 4;
  const roleAssignments = assignRoles(numPlayers);

  const hands: Record<PlayerID, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) {
    hands[seat] = {};
  }

  return {
    bank: bagOf({ gold: 3 }),
    centerMat: {},
    roleAssignments,
    round: 0,
    hands,
  };
};
