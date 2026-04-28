// Barrel for the Settlement game module.
// Re-exports the pure types/helpers and the assembled bgio `Game` config.

import type { Game } from 'boardgame.io';
import type { SettlementState } from './types.ts';
import { setup } from './setup.ts';
import {
  pass,
  pullFromMat,
  chiefDistribute,
  chiefEndPhase,
  chiefPlaceWorker,
  chiefPlayGoldEvent,
  __testSetPhaseDone,
  __testSetOthersDone,
} from './moves.ts';
import { chiefPhase, othersPhase, endOfRound } from './phases/index.ts';
import { playerView } from './playerView.ts';

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
  // The `__test*` moves are a temporary scaffold so 02.1's tests can drive
  // phase transitions before the real chief/others moves land. They will be
  // removed once 04.2 ships `chiefEndPhase` and the others-phase role stubs.
  moves: {
    pass,
    pullFromMat,
    chiefDistribute,
    chiefEndPhase,
    chiefPlaceWorker,
    chiefPlayGoldEvent,
    __testSetPhaseDone,
    __testSetOthersDone,
  },
  // Game-level default: every move ends the turn so `pass` cleanly cycles
  // seats. Phase-level `turn` configs override this with their own
  // `activePlayers` map (chief-only, others-only) — the cycling default
  // here only affects fall-through behavior outside an active stage.
  turn: { minMoves: 1, maxMoves: 1 },
  phases: { chiefPhase, othersPhase, endOfRound },
  playerView,
};
