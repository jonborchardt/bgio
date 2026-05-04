// Move definitions for Settlement.
//
// `pass` is the only legal *gameplay* move at this skeleton stage — it does
// nothing to G and lets the engine advance the turn. Real moves register
// here as later stages land (build, draft, trade, etc.).

import type { Move } from 'boardgame.io';
import type { PlayerID, SettlementState } from './types.ts';
import { chiefDistribute } from './roles/chief/distribute.ts';
import { chiefEndPhase } from './roles/chief/endPhase.ts';
import { chiefFlipTrack } from './roles/chief/flipTrack.ts';
import { chiefPlaceWorker } from './roles/chief/workerPlacement.ts';
import { chiefPlayGoldEvent } from './roles/chief/playGoldEvent.ts';
import { sciencePlayBlueEvent } from './roles/science/playBlueEvent.ts';
import { domesticPlayGreenEvent } from './roles/domestic/playGreenEvent.ts';
import { domesticBuyBuilding } from './roles/domestic/buy.ts';
import { domesticUpgradeBuilding } from './roles/domestic/upgrade.ts';
import { domesticProduce } from './roles/domestic/produce.ts';
import { domesticRepair } from './roles/domestic/repair.ts';
import { undoLast } from './undo.ts';
import { scienceContribute } from './roles/science/contribute.ts';
import { scienceComplete } from './roles/science/complete.ts';
import { eventResolve } from './events/resolveMove.ts';
import { chiefPlayTech } from './roles/chief/playTech.ts';
import { sciencePlayTech } from './roles/science/playTech.ts';
import { domesticPlayTech } from './roles/domestic/playTech.ts';
import { scienceSeatDone } from './roles/science/seatDone.ts';
import { domesticSeatDone } from './roles/domestic/seatDone.ts';
import { defenseSeatDone } from './roles/defense/seatDone.ts';
import { requestHelp } from './requests/move.ts';

export const pass: Move<SettlementState> = () => {
  // intentional no-op — bgio advances the turn after the move resolves.
};

// Chief role moves (04.1, 04.2, 04.3, 04.4). Phase gating is enforced
// inside each move against `ctx.phase === 'chiefPhase'`, so the bgio-level
// stage/phase config only has to authorize the chief seat in chiefPhase.
// `chiefPlaceWorker` and `chiefPlayGoldEvent` are STUBS gated behind
// feature flags / 08-dependency checks until the corresponding slices land
// (see their module-level docs for details).
export {
  chiefDistribute,
  chiefEndPhase,
  chiefFlipTrack,
  chiefPlaceWorker,
  chiefPlayGoldEvent,
};

// Science role moves (05.2 contribute, 05.3 complete). The Science seat
// drives both inside the `scienceTurn` stage of `othersPhase`; gating is
// enforced inside each move against `ctx.activePlayers?.[playerID]` so the
// bgio-level stage config only has to authorize the science seat in that
// stage.
export { scienceContribute, scienceComplete };

// Per-color event-card moves (05.4 / 06.6). Defense's red event move is
// retired in 1.4 (D14) — the trade / battle effects it dispatched are gone.
// Phase 2 will reintroduce a defense event-card play move atop the new
// track / unit economy.
export { sciencePlayBlueEvent, domesticPlayGreenEvent };

// 08.3 — `eventResolve` is the follow-up move for play*Event-dispatched
// `awaitInput` effects (e.g. `swapTwoScienceCards`). It reads the parked
// effect from `G._awaitingInput[playerID]`, applies it with the supplied
// payload, and pops the seat back to the prior stage. Stage gating is
// enforced inside the move (must be in `playingEvent`).
export { eventResolve };

// 08.6 — Per-role tech-play moves. Each gates on the caller holding the
// matching role and on the named card existing in that role's tech-card
// hand with non-empty `onPlayEffects`. All three share the
// `playTechStub` factory under `tech/playTechStub.ts`. Defense's tech-play
// move is retired in 1.4 (the red tech onPlayEffects today are battle-
// resolver hooks that no longer exist); Phase 2.5 reintroduces it once
// the new defense card economy lands.
export {
  chiefPlayTech,
  sciencePlayTech,
  domesticPlayTech,
};

// Generic single-slot undo for the seat's most recent card-play / recruit
// action. See `./undo.ts` for the contract; the move is stage-agnostic and
// gates internally on `_lastAction.seat === playerID`.
export { undoLast };

// Domestic role moves (06.2 buy / upgrade, 06.4 produce, 1.3 repair).
// Stage gating is enforced inside each move against
// `ctx.activePlayers?.[playerID] === 'domesticTurn'`, so the bgio-level
// stage config only has to authorize the domestic seat in that stage.
// `domesticProduce` is once-per-round and idempotent via
// `G.domestic.producedThisRound`, cleared by the
// `domestic:reset-produced` round-end hook registered in `produce.ts`.
// `domesticRepair` is the new spend sink for the building-HP loop
// (defense redesign D17): pay gold from stash, restore up to `amount`
// HP capped at `maxHp - hp`.
export {
  domesticBuyBuilding,
  domesticUpgradeBuilding,
  domesticProduce,
  domesticRepair,
};

// 14.2 — per-role "I'm done" moves. Each flips `G.othersDone[seat]`
// after the seat finishes its work in `othersPhase`; bgio re-evaluates
// `othersPhase.endIf` after the move and transitions to `endOfRound`
// once every non-chief seat has flipped. The chief uses `chiefEndPhase`
// for the analogous transition out of `chiefPhase`.
export { scienceSeatDone, domesticSeatDone, defenseSeatDone };

// Help-request toggle. Stage-agnostic — any seat can ask another for
// help with a currently-disabled action at any time. The recipient
// auto-loses the row when the requester completes the action (see
// `clearRequestsForTarget` calls in the completion sites).
export { requestHelp };

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

// Dev-only: grant `amount` of every resource to every role. The chief
// receives via `G.bank` (their working pool); every non-chief seat
// receives directly into `mats[seat].stash` so their spend moves can
// draw from it without a chief-distribute round-trip. The bank top-up
// is logged through the audit trail so the chief tooltip still narrates
// what happened; per-seat stash bumps don't have a comparable log.
export const __devGrantAllRoles: Move<SettlementState> = (
  { G },
  amount: number,
) => {
  const safeAmount =
    typeof amount === 'number' && Number.isFinite(amount) && amount > 0
      ? Math.floor(amount)
      : 10;
  const RESOURCE_KEYS = [
    'gold', 'wood', 'stone', 'steel', 'horse',
    'food', 'production', 'science', 'happiness', 'worker',
  ] as const;
  const delta: Record<string, number> = {};
  for (const r of RESOURCE_KEYS) {
    G.bank[r] = (G.bank[r] ?? 0) + safeAmount;
    delta[r] = safeAmount;
  }
  if (G.bankLog === undefined) G.bankLog = [];
  G.bankLog.push({
    round: G.round,
    source: 'dev',
    delta,
    detail: `Dev: +${safeAmount} of each (all roles)`,
  });
  for (const mat of Object.values(G.mats)) {
    for (const r of RESOURCE_KEYS) {
      mat.stash[r] = (mat.stash[r] ?? 0) + safeAmount;
    }
  }
};
