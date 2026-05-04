// domesticBuyBuilding (06.2) — the Domestic seat pays gold from their stash
// to buy a BuildingDef out of `G.domestic.hand` and place it on the grid at
// `(x, y)`. Game-design.md §Domestic: "buy a building from your hand and
// place it on the grid adjacent to an existing building (or anywhere if the
// grid is empty)."
//
// Cost is resolved via `buildingCost(def)` from the data barrel: it returns
// `def.costBag` when the JSON row carries a multi-resource cost, else falls
// back to `{ gold: def.cost }`. This file pays whatever bag that yields, so
// gold-only and mixed-resource buildings share the same code path.
//
// Stage gating: the move requires the caller to hold `domestic` AND be in
// the `domesticTurn` stage so event-stage interrupts (which push
// `playingEvent` per 02.2) can't sneak through during the Domestic seat's
// turn.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { buildingCost } from '../../../data/index.ts';
import { cellKey, isPlacementLegal } from './grid.ts';
import { pushGraveyard } from '../../graveyard.ts';
import { idForBuilding } from '../../../cards/registry.ts';
import { markUndoable } from '../../undo.ts';
import { clearRequestsForTarget } from '../../requests/clear.ts';

export const domesticBuyBuilding: Move<SettlementState> = (
  { G, ctx, playerID },
  cardName: string,
  x: number,
  y: number,
) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  // Caller must hold the domestic role.
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }

  // The Domestic seat acts only inside the `domesticTurn` stage of
  // `othersPhase`. We check stage explicitly rather than phase so
  // event-stage interrupts (02.2) can't sneak through during the Domestic
  // seat's turn.
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  const domestic = G.domestic;
  if (domestic === undefined) return INVALID_MOVE;

  // Locate the BuildingDef in the seat's hand by name. We search the hand
  // (not the global BUILDINGS array) so a player can't summon a building
  // that isn't currently in their pile.
  const handIndex = domestic.hand.findIndex((b) => b.name === cardName);
  if (handIndex === -1) return INVALID_MOVE;
  const def = domestic.hand[handIndex]!;

  // Stash must cover the cost — gold-only or multi-resource depending on
  // whether the def carries a `costBag`. `buildingCost` normalizes both
  // shapes into a `Partial<ResourceBag>`.
  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = buildingCost(def);
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  // Placement must be legal: target cell empty, and either the grid is
  // empty (any cell) or the cell is orthogonally adjacent to an existing
  // building.
  if (!isPlacementLegal(domestic.grid, x, y)) return INVALID_MOVE;

  // All gates passed — pay the bank, splice the card out of the hand, and
  // record the placed building. `payFromStash` would throw on underflow,
  // but we already checked `canAfford` above, so the throw path is dead
  // code under correct callers.
  markUndoable(G, `Build ${cardName}`, playerID);
  payFromStash(G, playerID, cost);
  domestic.hand.splice(handIndex, 1);
  // Defense redesign D15 — placed buildings ship with full HP. `maxHp`
  // is read off the BuildingDef once at placement; subsequent reads come
  // off the placed cell so a future upgrade that raises maxHp doesn't
  // have to backfill on every consumer.
  domestic.grid[cellKey(x, y)] = {
    defID: cardName,
    upgrades: 0,
    worker: null,
    hp: def.maxHp,
    maxHp: def.maxHp,
  };
  pushGraveyard(G, playerID, {
    cardId: idForBuilding(def),
    kind: 'building',
    name: cardName,
  });
  clearRequestsForTarget(G, idForBuilding(def));
};
