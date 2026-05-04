// domesticUpgradeBuilding (06.2) — the Domestic seat upgrades an in-play
// building by paying a "delta" cost (V1 stub: 50% of the base gold cost,
// floored).
//
// The plan flags this as a stub: until upgrade content lands, every upgrade
// just bumps `building.upgrades` by 1 and charges `floor(originalDef.cost
// * 0.5)` gold. `upgradeCardName` is accepted for API parity with the
// future signature (when upgrade chains exist as data-driven cards), but
// V1 does not validate it against any registry — we just trust the caller
// supplied a sensible string id.
//
// Stage gating mirrors `domesticBuyBuilding`: caller must hold `domestic`
// and be in stage `domesticTurn`.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { BUILDINGS } from '../../../data/index.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { cellKey } from './grid.ts';
import { clearUndoable } from '../../undo.ts';

export const domesticUpgradeBuilding: Move<SettlementState> = (
  { G, ctx, playerID },
  x: number,
  y: number,
  upgradeCardName: string,
) => {
  // bgio passes the acting seat as a top-level `playerID` on the move args.
  if (playerID === undefined || playerID === null) return INVALID_MOVE;

  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return INVALID_MOVE;

  const domestic = G.domestic;
  if (domestic === undefined) return INVALID_MOVE;

  // V1: accept `upgradeCardName` for API stability but don't validate it
  // against an upgrade registry — see file-level note.
  void upgradeCardName;

  // Cell must be occupied.
  const key = cellKey(x, y);
  const building = domestic.grid[key];
  if (building === undefined) return INVALID_MOVE;
  // Defense redesign D2 — the center tile is a coordinate anchor, not a
  // building. It is not upgradeable.
  if (building.isCenter === true) return INVALID_MOVE;

  // Look up the original def to compute the delta cost. If the building's
  // defID is missing from BUILDINGS we treat the upgrade as illegal —
  // there's no sensible base cost to scale.
  const originalDef = BUILDINGS.find((b) => b.name === building.defID);
  if (originalDef === undefined) return INVALID_MOVE;

  // V1 stub: delta cost = floor(originalCost * 0.5).
  const deltaCost = Math.floor(originalDef.cost * 0.5);

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = { gold: deltaCost };
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  clearUndoable(G);

  // Pay the bank if the delta is non-zero (a 0-cost upgrade is a no-op
  // payment but still legitimately bumps the counter — e.g. `cost=1` →
  // floor(0.5) = 0). `payFromStash` would underflow on a negative amount;
  // `canAfford` already guards against that.
  if (deltaCost > 0) payFromStash(G, playerID, cost);
  building.upgrades += 1;
};
