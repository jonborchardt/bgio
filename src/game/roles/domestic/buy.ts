// domesticBuyBuilding (06.2) — the Domestic seat pays gold from their wallet
// to buy a BuildingDef out of `G.domestic.hand` and place it on the grid at
// `(x, y)`. Game-design.md §Domestic: "buy a building from your hand and
// place it on the grid adjacent to an existing building (or anywhere if the
// grid is empty)."
//
// The cost field on a BuildingDef is a bare `cost: number` (gold). For V1 we
// treat it as `{ gold: cost }` — see plan 06.2 for why we don't expand to a
// resource bag yet (no current building has a non-gold cost).
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
import { payFromWallet } from '../../resources/moves.ts';
import { cellKey, isPlacementLegal } from './grid.ts';

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

  // Wallet must cover the gold cost. The BuildingDef stores `cost` as a
  // bare number — V1 treats it as gold (see file-level note).
  const wallet = G.wallets[playerID];
  if (!wallet) return INVALID_MOVE;
  const cost = { gold: def.cost };
  if (!canAfford(wallet, cost)) return INVALID_MOVE;

  // Placement must be legal: target cell empty, and either the grid is
  // empty (any cell) or the cell is orthogonally adjacent to an existing
  // building.
  if (!isPlacementLegal(domestic.grid, x, y)) return INVALID_MOVE;

  // All gates passed — pay the bank, splice the card out of the hand, and
  // record the placed building. `payFromWallet` would throw on underflow,
  // but we already checked `canAfford` above, so the throw path is dead
  // code under correct callers.
  payFromWallet(G, playerID, cost);
  domestic.hand.splice(handIndex, 1);
  domestic.grid[cellKey(x, y)] = {
    defID: cardName,
    upgrades: 0,
    worker: null,
  };
};
