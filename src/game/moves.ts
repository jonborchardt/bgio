// Move definitions for Settlement.
//
// `pass` is the only legal *gameplay* move at this skeleton stage — it does
// nothing to G and lets the engine advance the turn. Real moves register
// here as later stages land (build, draft, trade, etc.).

import type { Move } from 'boardgame.io';
import type { PlayerID, SettlementState } from './types.ts';
import { pullFromMat } from './resources/moves.ts';
import { chiefDistribute } from './roles/chief/distribute.ts';
import { chiefEndPhase } from './roles/chief/endPhase.ts';
import { chiefPlaceWorker } from './roles/chief/workerPlacement.ts';
import { chiefPlayGoldEvent } from './roles/chief/playGoldEvent.ts';
import { sciencePlayBlueEvent } from './roles/science/playBlueEvent.ts';
import { domesticPlayGreenEvent } from './roles/domestic/playGreenEvent.ts';
import { foreignPlayRedEvent } from './roles/foreign/playRedEvent.ts';
import { scienceContribute } from './roles/science/contribute.ts';
import { scienceComplete } from './roles/science/complete.ts';

export const pass: Move<SettlementState> = () => {
  // intentional no-op — bgio advances the turn after the move resolves.
};

// Re-export resource moves from the canonical moves barrel so `index.ts`
// only has to know about this one file. Stage/phase gating for `pullFromMat`
// happens at the bgio config layer (see plan 02.x), not here.
export { pullFromMat };

// Chief role moves (04.1, 04.2, 04.3, 04.4). Phase gating is enforced
// inside each move against `ctx.phase === 'chiefPhase'`, so the bgio-level
// stage/phase config only has to authorize the chief seat in chiefPhase.
// `chiefPlaceWorker` and `chiefPlayGoldEvent` are STUBS gated behind
// feature flags / 08-dependency checks until the corresponding slices land
// (see their module-level docs for details).
export {
  chiefDistribute,
  chiefEndPhase,
  chiefPlaceWorker,
  chiefPlayGoldEvent,
};

// Science role moves (05.2 contribute, 05.3 complete). The Science seat
// drives both inside the `scienceTurn` stage of `othersPhase`; gating is
// enforced inside each move against `ctx.activePlayers?.[playerID]` so the
// bgio-level stage config only has to authorize the science seat in that
// stage.
export { scienceContribute, scienceComplete };

// Per-color event-card stubs (05.4 / 06.6 / 07.6). Near-clones of 04.4
// chiefPlayGoldEvent — they share the `playEventStub` factory in
// `src/game/events/playEventStub.ts`. Each only owns role-gating and
// per-round bookkeeping until 08.3 wires the typed effect dispatcher.
export { sciencePlayBlueEvent, domesticPlayGreenEvent, foreignPlayRedEvent };

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
