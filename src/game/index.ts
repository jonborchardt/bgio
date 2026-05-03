// Barrel for the Settlement game module.
// Re-exports the pure types/helpers and the assembled bgio `Game` config.

import type { Game } from 'boardgame.io';
import type { SettlementState } from './types.ts';
import { setup } from './setup.ts';
import {
  pass,
  chiefDistribute,
  chiefEndPhase,
  chiefPlaceWorker,
  chiefPlayGoldEvent,
  chiefDecideTradeDiscard,
  sciencePlayBlueEvent,
  domesticPlayGreenEvent,
  foreignPlayRedEvent,
  foreignRecruit,
  foreignUpkeep,
  foreignReleaseUnit,
  undoLast,
  foreignFlipBattle,
  foreignAssignDamage,
  foreignFlipTrade,
  foreignTradeFulfill,
  scienceContribute,
  scienceComplete,
  domesticBuyBuilding,
  domesticUpgradeBuilding,
  domesticProduce,
  eventResolve,
  chiefPlayTech,
  sciencePlayTech,
  domesticPlayTech,
  foreignPlayTech,
  scienceSeatDone,
  domesticSeatDone,
  foreignSeatDone,
  requestHelp,
  __testSetPhaseDone,
  __testSetOthersDone,
  __devGrantAllRoles,
} from './moves.ts';
import { chiefPhase, othersPhase, endOfRound } from './phases/index.ts';
import { playerView } from './playerView.ts';
import { endIf } from './endConditions.ts';
import { enumerate } from './ai/enumerate.ts';

export type {
  CenterMat,
  PlayerID,
  ResourceBag,
  Role,
  SettlementState,
} from './types.ts';

export { assignRoles, rolesAtSeat, seatOfRole } from './roles.ts';

// Production move set. The `__test*` moves are deliberately excluded:
// they exist only so 02.1's phase-transition tests can flip
// `G.phaseDone` / `G.othersDone[seat]` without driving the real
// chief/others moves, and a network adversary calling them would skip
// turns at will. We expose them via `__SettlementTestMoves` (below)
// for tests that want to mount the engine with the scaffolds enabled.
const productionMoves = {
  pass,
  chiefDistribute,
  chiefEndPhase,
  chiefPlaceWorker,
  chiefPlayGoldEvent,
  chiefDecideTradeDiscard,
  sciencePlayBlueEvent,
  domesticPlayGreenEvent,
  foreignPlayRedEvent,
  foreignRecruit,
  foreignUpkeep,
  foreignReleaseUnit,
  undoLast,
  foreignFlipBattle,
  foreignAssignDamage,
  foreignFlipTrade,
  foreignTradeFulfill,
  scienceContribute,
  scienceComplete,
  domesticBuyBuilding,
  domesticUpgradeBuilding,
  domesticProduce,
  eventResolve,
  chiefPlayTech,
  sciencePlayTech,
  domesticPlayTech,
  foreignPlayTech,
  scienceSeatDone,
  domesticSeatDone,
  foreignSeatDone,
  requestHelp,
};

/** Test-only move scaffolds. Imported into the engine via
 * `Settlement` only when `process.env.NODE_ENV === 'test'` (Vitest sets
 * this) OR when a test explicitly opts in via
 * `withTestMoves(Settlement)`. Never reachable in a production bundle. */
export const __SettlementTestMoves = {
  __testSetPhaseDone,
  __testSetOthersDone,
};

/** Dev-only convenience moves. Bundled with the engine in any non-
 * production NODE_ENV (test + development) so the DevSidebar's testing
 * shortcuts are reachable. Stripped from production builds. */
export const __SettlementDevMoves = {
  __devGrantAllRoles,
};

const isTestEnv =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

// Dev-mode detection across three runtimes:
//   - Vite browser dev/prod build: `import.meta.env.DEV` is the canonical
//     signal (true in `vite dev`, false in `vite build`). `process` is
//     not defined as a runtime global in the browser, so checking it
//     would either crash or read undefined.
//   - vite-node (the server runner): both `import.meta.env` and
//     `process.env` are defined; either works, the import.meta path
//     wins by accident.
//   - Pure Node (vitest in default jsdom mode still goes through Vite,
//     but headless Node fixtures might not): `process.env.NODE_ENV`
//     is the only signal available.
//
// We OR the two checks: any non-production runtime opts in. The naive
// "typeof process === 'undefined' || NODE_ENV !== 'production'" form is
// dangerous because the `typeof process === 'undefined'` arm short-
// circuits to true in production browser builds and leaks dev moves.
// The "typeof process !== 'undefined' && NODE_ENV !== 'production'"
// form (the previous fix) correctly bails in prod but ALSO bails in dev
// browsers — `process` simply isn't there. import.meta.env.DEV is the
// browser's source of truth.
const isViteDev =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
const isNodeNonProd =
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV !== 'production';
const isNonProd = isViteDev || isNodeNonProd;

export const Settlement: Game<SettlementState> = {
  name: 'settlement',
  setup,
  moves: {
    ...productionMoves,
    ...(isTestEnv ? __SettlementTestMoves : {}),
    ...(isNonProd ? __SettlementDevMoves : {}),
  },
  // Game-level default: every move ends the turn so `pass` cleanly cycles
  // seats. Phase-level `turn` configs override this with their own
  // `activePlayers` map (chief-only, others-only) — the cycling default
  // here only affects fall-through behavior outside an active stage.
  turn: { minMoves: 1, maxMoves: 1 },
  phases: { chiefPhase, othersPhase, endOfRound },
  playerView,
  // 08.5: bgio's `endIf` receives `{ G, ctx }` and any truthy return value
  // sets `ctx.gameover` to that value (a `GameOutcome`). The wrapper here
  // adapts the bgio shape to our pure 2-arg `endIf`.
  endIf: ({ G, ctx }) => endIf(G, ctx),
  // 11.2 — bgio's `RandomBot` / `MCTSBot` call `Game.ai.enumerate(G, ctx,
  // playerID)` to learn the legal move surface at a given state. Our
  // enumerator inspects the phase / stage and returns a bounded list of
  // plausible candidates; move bodies still own real legality via
  // `INVALID_MOVE`.
  ai: { enumerate },
};
