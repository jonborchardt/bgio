// Move definitions for Settlement.
//
// `pass` is the only legal *gameplay* move at this skeleton stage — it does
// nothing to G and lets the engine advance the turn. Real moves register
// here as later stages land (build, draft, trade, etc.).

import type { Move } from 'boardgame.io';
import type { PlayerID, SettlementState } from './types.ts';
import { pullFromMat } from './resources/moves.ts';

export const pass: Move<SettlementState> = () => {
  // intentional no-op — bgio advances the turn after the move resolves.
};

// Re-export resource moves from the canonical moves barrel so `index.ts`
// only has to know about this one file. Stage/phase gating for `pullFromMat`
// happens at the bgio config layer (see plan 02.x), not here.
export { pullFromMat };

// ---------------------------------------------------------------------------
// Test-only scaffolding.
//
// These moves exist so 02.1's phase-transition tests can flip the phase-end
// flags without depending on chief/others gameplay moves that don't exist
// yet. bgio re-checks each phase's `endIf` after every move, so just setting
// the flag is enough to trigger the transition — no explicit `events.endPhase`
// call needed.
//
// Both will be removed once 04.2 lands `chiefEndPhase` and the others-phase
// role stubs ship the real "I'm done" moves.
// ---------------------------------------------------------------------------

export const __testSetPhaseDone: Move<SettlementState> = ({ G }) => {
  G.phaseDone = true;
};

export const __testSetOthersDone: Move<SettlementState> = (
  { G },
  seat: PlayerID,
) => {
  if (!G.othersDone) G.othersDone = {};
  G.othersDone[seat] = true;
};
