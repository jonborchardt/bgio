// domesticProduce (06.4) — the Domestic seat's once-per-round move that
// totals the parsed `BuildingDef.benefit` yields across every placed
// building (with an extra "doubling" for cells holding a worker token), and
// deposits the result into `G.bank`.
//
// game-design.md §Domestic: "Calculate all produced goods … if a building
// has a worker, the worker goods are in addition to the normal default
// goods." V1 worker bonus = same as the default yield — i.e. a worker
// doubles the cell's contribution. Future content can layer a typed
// `WorkerBonusDef` on top; the parser already exposes the structured
// `BenefitYield` we'd need to mix richer bonuses in.
//
// `parsed.effects` are intentionally *not* applied here — they affect other
// moves (Foreign upkeep / recruit, combat, happiness). This move only
// flushes the resource side of each benefit.
//
// Stage gating mirrors the other Domestic moves (06.2): caller must hold
// `domestic` and be in stage `domesticTurn`. Idempotency is enforced via a
// per-round `producedThisRound` flag on `DomesticState`, cleared at
// endOfRound by the `domestic:reset-produced` hook registered below at
// module load.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { BUILDINGS } from '../../../data/index.ts';
import { add } from '../../resources/bag.ts';
import { EMPTY_BAG } from '../../resources/types.ts';
import type { ResourceBag } from '../../resources/types.ts';
import { registerRoundEndHook } from '../../hooks.ts';
import { parseBenefit, type BenefitYield } from './parseBenefit.ts';
import { adjacencyRules, yieldAdjacencyBonus } from './adjacency.ts';

export const domesticProduce: Move<SettlementState> = ({ G, ctx, playerID }) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  const domestic = G.domestic;
  if (domestic === undefined) return INVALID_MOVE;

  // Idempotency latch: cleared at endOfRound by the hook below.
  if (domestic.producedThisRound === true) return INVALID_MOVE;

  // Cache parses across the move so a building type that appears twice in
  // the grid only walks the parser once. Skip silently on a missing
  // BuildingDef (data drift / hand-built fixture) — the move shouldn't
  // crash the round.
  const parseCache = new Map<string, BenefitYield>();
  let runningYield: ResourceBag = { ...EMPTY_BAG };

  for (const placed of Object.values(domestic.grid)) {
    const def = BUILDINGS.find((b) => b.name === placed.defID);
    if (def === undefined) continue;

    let parsed = parseCache.get(placed.defID);
    if (parsed === undefined) {
      // An empty benefit string is legal (no current building has one,
      // but defensively avoid throwing). `parseBenefit` already returns
      // `{ resources: {}, effects: [] }` for the empty string, so the
      // cache entry is a degenerate but correct yield.
      parsed = parseBenefit(def.benefit);
      parseCache.set(placed.defID, parsed);
    }

    runningYield = add(runningYield, parsed.resources);
    // V1 worker bonus = same as default → workered cells contribute
    // their parsed resources twice. `effects` are not applied here.
    if (placed.worker !== null) {
      runningYield = add(runningYield, parsed.resources);
    }
  }

  // 06.5: layer in the adjacency-bonus bag. Pure helper; reads the live
  // module-level registry so 06.8's content (and tests) flow through.
  runningYield = add(runningYield, yieldAdjacencyBonus(domestic.grid, adjacencyRules));

  // Deposit straight into the bank — there's no source bag to debit (the
  // resources are conjured out of the production model). 06.4 plan calls
  // for `transfer(EMPTY_BAG, G.bank, total)` semantically; we use `add`
  // directly to avoid mutating the frozen `EMPTY_BAG` constant.
  G.bank = add(G.bank, runningYield);

  domestic.producedThisRound = true;
};

// Round-end hook: clear the per-round produce latch so next round's
// `domesticProduce` can fire again. Registered at module load (idempotent —
// see 02.5 hooks registry contract). Tests that need a clean slate must
// call `__resetHooksForTest()` and then re-import this module.
//
// Lazy init: if `G.domestic` exists but `producedThisRound` was never set
// (fresh setup, never called produce), reading it is `undefined` and we
// can leave it unset; explicitly writing `false` keeps the flag stable for
// any consumer that relies on the "after a round, the flag is false"
// shape.
registerRoundEndHook('domestic:reset-produced', (G) => {
  if (G.domestic === undefined) return;
  G.domestic.producedThisRound = false;
});
