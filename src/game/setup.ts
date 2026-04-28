// Pure setup for the Settlement game.
//
// Returns a flat single-phase initial state. Phases, real decks, and
// per-player private hands arrive in 02.x / 03.x; until then `hands` is
// an empty placeholder and the bank is seeded with the default starter
// `gold: 3` (per 03.2). The center mat (03.3) builds one circle per
// non-chief seat and an empty trade-request slot.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, ResourceBag, SettlementState } from './types.ts';
import { assignRoles } from './roles.ts';
import { initialBank } from './resources/bank.ts';
import { bagOf } from './resources/bag.ts';
import { initialMat } from './resources/centerMat.ts';

export const setup = ({ ctx }: { ctx: Ctx }): SettlementState => {
  const numPlayers = ctx.numPlayers as 1 | 2 | 3 | 4;
  const roleAssignments = assignRoles(numPlayers);

  const hands: Record<PlayerID, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) {
    hands[seat] = {};
  }

  // Per-seat wallets for every non-chief seat. The chief acts on the bank
  // directly and is intentionally absent from the map (see types.ts).
  const wallets: Record<PlayerID, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      wallets[seat] = bagOf({});
    }
  }

  return {
    bank: initialBank(),
    centerMat: initialMat(roleAssignments),
    roleAssignments,
    round: 0,
    hands,
    wallets,
    // Phase-progress flags — flipped by 04.2's chiefEndPhase move and the
    // others-phase role stubs. Reset at the top of every `endOfRound` phase.
    phaseDone: false,
    othersDone: {},
    // Per-seat stack for `enterEventStage`/`exitEventStage` (02.2). Lazy-
    // initialized in `enterEventStage` too, but we seed an empty object so
    // observers and tests can rely on the property being present.
    _stageStack: {},
  };
};
