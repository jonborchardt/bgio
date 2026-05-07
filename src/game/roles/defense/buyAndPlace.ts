// Defense redesign 2.5 — `defenseBuyAndPlace` move.
//
// The Defense seat pays the unit's `costBag` (or `{ gold: cost }`) from
// their stash, then immediately places one instance of the unit onto a
// non-center building tile on the Domestic grid (D11). The unit card
// stays in the seat's hand — recruits draw from a card pool, not a
// single-use deck (mirrors the spec note in the sub-phase plan).
//
// Validations (in order):
//   1. caller has a defined playerID and holds the `defense` role,
//   2. caller is in stage `defenseTurn` (D14 — no upkeep gate),
//   3. `G.defense` exists and the unit name resolves in `defense.hand`,
//   4. `cellKey` resolves to a placed Domestic building, the cell is
//      not the center tile (D11), and a real building (not a stub),
//   5. the seat's stash covers the unit's cost.
//
// On success: snapshot for undo, pay the bank from the stash, append a
// new `UnitInstance` to `G.defense.inPlay` with a fresh `id` and
// monotonically increasing `placementOrder` (D13). Per spec D11 stacks
// are uncapped — multiple units on the same tile is intentional.
//
// `placementOrder` lives on `G.defense._placementSeq` so the counter is
// authoritative and survives across rounds. The plan's prose mentions
// `_instanceCounter` and `_defensePlacementSeq` as separate fields; we
// fold them into one because both want a single monotonic ticker.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import { canAfford } from '../../resources/bag.ts';
import { payFromStash } from '../../resources/moves.ts';
import { unitCost } from '../../../data/index.ts';
import { pushGraveyard } from '../../graveyard.ts';
import { idForUnit } from '../../../cards/registry.ts';
import { markUndoable } from '../../undo.ts';
import { clearRequestsForTarget } from '../../requests/clear.ts';
import { nextPlacementOrder } from './placementSeq.ts';

export const defenseBuyAndPlace: Move<SettlementState> = (
  { G, ctx, playerID },
  unitDefID: string,
  cellKey: string,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('defense')) {
    return INVALID_MOVE;
  }
  if (ctx.activePlayers?.[playerID] !== 'defenseTurn') return INVALID_MOVE;

  const defense = G.defense;
  if (defense === undefined) return INVALID_MOVE;

  if (typeof unitDefID !== 'string' || unitDefID.length === 0) {
    return INVALID_MOVE;
  }
  if (typeof cellKey !== 'string' || cellKey.length === 0) {
    return INVALID_MOVE;
  }

  const def = defense.hand.find((u) => u.name === unitDefID);
  if (def === undefined) return INVALID_MOVE;

  // Tile must be a placed (non-center) building owned by domestic.
  const grid = G.domestic?.grid ?? {};
  const cell = grid[cellKey];
  if (cell === undefined) return INVALID_MOVE;
  if (cell.isCenter === true) return INVALID_MOVE;

  const mat = G.mats?.[playerID];
  if (mat === undefined) return INVALID_MOVE;
  const cost = unitCost(def);
  if (!canAfford(mat.stash, cost)) return INVALID_MOVE;

  // All gates passed — snapshot, pay, place.
  markUndoable(G, `Recruit ${def.name}`, playerID);
  payFromStash(G, playerID, cost);

  const order = nextPlacementOrder(G);
  defense.inPlay.push({
    id: `u:${def.name}:${order}`,
    defID: def.name,
    cellKey,
    hp: def.hp,
    placementOrder: order,
  });

  pushGraveyard(G, playerID, {
    cardId: idForUnit(def),
    kind: 'unit',
    name: def.name,
  });
  clearRequestsForTarget(G, idForUnit(def));
};
