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
import { domesticBuyBuilding } from './roles/domestic/buy.ts';
import { domesticUpgradeBuilding } from './roles/domestic/upgrade.ts';
import { domesticProduce } from './roles/domestic/produce.ts';
import { foreignPlayRedEvent } from './roles/foreign/playRedEvent.ts';
import { foreignRecruit } from './roles/foreign/recruit.ts';
import { foreignUpkeep } from './roles/foreign/upkeep.ts';
import { foreignReleaseUnit } from './roles/foreign/release.ts';
import {
  foreignFlipBattle,
  foreignFlipTrade,
} from './roles/foreign/flip.ts';
import { foreignAssignDamage } from './roles/foreign/assignDamage.ts';
import { chiefDecideTradeDiscard } from './roles/chief/decideTradeDiscard.ts';
import { scienceContribute } from './roles/science/contribute.ts';
import { scienceComplete } from './roles/science/complete.ts';
import { eventResolve } from './events/resolveMove.ts';

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
  chiefDecideTradeDiscard,
};

// Science role moves (05.2 contribute, 05.3 complete). The Science seat
// drives both inside the `scienceTurn` stage of `othersPhase`; gating is
// enforced inside each move against `ctx.activePlayers?.[playerID]` so the
// bgio-level stage config only has to authorize the science seat in that
// stage.
export { scienceContribute, scienceComplete };

// Per-color event-card moves (05.4 / 06.6 / 07.6). Near-clones of 04.4
// chiefPlayGoldEvent — they share the `playEventStub` factory in
// `src/game/events/playEventStub.ts`. Each owns role-gating, per-round
// bookkeeping, and (08.3) effect dispatch via the typed dispatcher.
export { sciencePlayBlueEvent, domesticPlayGreenEvent, foreignPlayRedEvent };

// 08.3 — `eventResolve` is the follow-up move for play*Event-dispatched
// `awaitInput` effects (e.g. `swapTwoScienceCards`). It reads the parked
// effect from `G._awaitingInput[playerID]`, applies it with the supplied
// payload, and pops the seat back to the prior stage. Stage gating is
// enforced inside the move (must be in `playingEvent`).
export { eventResolve };

// Foreign role unit moves (07.2): recruit / upkeep / release. Stage gating
// is enforced inside each move against `ctx.activePlayers?.[playerID] ===
// 'foreignTurn'`, so the bgio-level stage config only has to authorize the
// foreign seat in that stage.
export { foreignRecruit, foreignUpkeep, foreignReleaseUnit };

// Foreign flip-flow moves (07.4) and trade-request placement (07.5).
// `foreignFlipBattle` puts the seat into `foreignAwaitingDamage`, which
// `foreignAssignDamage` resolves; `foreignFlipTrade` either drops the
// drawn card straight into the mat slot or stashes it for the chief to
// resolve via `chiefDecideTradeDiscard` (registered above with the other
// chief moves).
export { foreignFlipBattle, foreignAssignDamage, foreignFlipTrade };

// Domestic role moves (06.2 buy / upgrade, 06.4 produce). Stage gating is
// enforced inside each move against `ctx.activePlayers?.[playerID] ===
// 'domesticTurn'`, so the bgio-level stage config only has to authorize the
// domestic seat in that stage. `domesticProduce` is once-per-round and
// idempotent via `G.domestic.producedThisRound`, cleared by the
// `domestic:reset-produced` round-end hook registered in `produce.ts`.
export { domesticBuyBuilding, domesticUpgradeBuilding, domesticProduce };

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
