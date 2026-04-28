// Barrel for the Settlement game module.
// Re-exports the pure types/helpers and the assembled bgio `Game` config.

import type { Game } from 'boardgame.io';
import type { SettlementState } from './types.ts';
import { setup } from './setup.ts';
import { pass } from './moves.ts';

export type {
  CenterMat,
  PlayerID,
  ResourceBag,
  Role,
  SettlementState,
} from './types.ts';

export { assignRoles, rolesAtSeat, seatOfRole } from './roles.ts';

export const Settlement: Game<SettlementState> = {
  name: 'settlement',
  setup,
  moves: { pass },
  // Until phases land in 02.1, every move ends the turn so `pass` cleanly
  // hands control to the next seat.
  turn: { minMoves: 1, maxMoves: 1 },
};
