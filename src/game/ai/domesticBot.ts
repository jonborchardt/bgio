// 11.5 — DomesticBot.
//
// Pure heuristic for the Domestic role:
//   1. If `producedThisRound` isn't set and the grid has at least one
//      building, return `domesticProduce` so the bank harvests yield
//      before any new placements happen this round.
//   2. Else: sort the hand by cost ascending. For each affordable card,
//      enumerate every legal placement cell and compute the hypothetical
//      adjacency-bonus bag via `yieldAdjacencyBonus` against a draft
//      grid that includes the proposed placement. Pick the cell with
//      the maximum total adjacency bonus (sum of all resource amounts);
//      ties broken by topmost-leftmost cell coordinate.
//   3. Else: return null.
//
// The bot deliberately ignores upgrades for V1; the plan calls them out
// as a fallback after no buys are affordable, but our test fixtures
// don't currently exercise them, and a production-aware upgrade
// heuristic adds more state-machine complexity than it pays back. The
// hooks above (returning null when no buys fit) leave the door open
// for a future revision to layer that in.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import { canAfford } from '../resources/bag.ts';
import { cellKey, isPlacementLegal } from '../roles/domestic/grid.ts';
import {
  adjacencyRules,
  yieldAdjacencyBonus,
} from '../roles/domestic/adjacency.ts';
import type { DomesticBuilding } from '../roles/domestic/types.ts';
import type { BuildingDef } from '../../data/schema.ts';
import { RESOURCES } from '../resources/types.ts';
import type { MoveCandidate } from './enumerate.ts';

export type BotAction = MoveCandidate;

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

interface CellChoice {
  x: number;
  y: number;
  bonus: number;
}

/**
 * Sum of every resource amount in the adjacency-bonus bag. We don't try
 * to weight different resources differently for V1 — any positive bonus
 * is better than none, and the hand is small so a flat sum is enough
 * to surface the strong placement.
 */
const sumBag = (bag: Record<string, number>): number => {
  let total = 0;
  for (const r of RESOURCES) total += bag[r] ?? 0;
  return total;
};

/**
 * Build the candidate-cell pool. If the grid is empty, return a single
 * origin cell. Otherwise return every empty cell orthogonally adjacent
 * to a placed building.
 */
const candidateCells = (
  grid: Record<string, DomesticBuilding>,
): Array<{ x: number; y: number }> => {
  const keys = Object.keys(grid);
  if (keys.length === 0) {
    return [{ x: 0, y: 0 }];
  }
  // Collect a deduplicated set of "neighbor of a placed cell that is
  // currently empty". Iterate placed keys in sorted order so the
  // deduplication output is deterministic.
  const seen = new Set<string>();
  const out: Array<{ x: number; y: number }> = [];
  const sortedKeys = [...keys].sort();
  for (const k of sortedKeys) {
    const parts = k.split(',');
    if (parts.length !== 2) continue;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const nk = cellKey(nx, ny);
      if (Object.prototype.hasOwnProperty.call(grid, nk)) continue;
      if (seen.has(nk)) continue;
      seen.add(nk);
      out.push({ x: nx, y: ny });
    }
  }
  // Sort by topmost-leftmost: smallest y first, then smallest x.
  out.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return out;
};

const bestCellFor = (
  grid: Record<string, DomesticBuilding>,
  card: BuildingDef,
): CellChoice | null => {
  const cells = candidateCells(grid);
  let best: CellChoice | null = null;
  for (const cell of cells) {
    if (!isPlacementLegal(grid, cell.x, cell.y)) continue;
    // Build a draft grid that includes the proposed placement.
    const draft: Record<string, DomesticBuilding> = { ...grid };
    draft[cellKey(cell.x, cell.y)] = {
      defID: card.name,
      upgrades: 0,
      worker: null,
    };
    const bonusBag = yieldAdjacencyBonus(draft, adjacencyRules);
    const bonus = sumBag(bonusBag);
    if (
      best === null ||
      bonus > best.bonus ||
      // Tie-break by topmost-leftmost — `cells` is already sorted that
      // way, so the first cell to hit a tying score keeps it.
      false
    ) {
      best = { x: cell.x, y: cell.y, bonus };
    }
  }
  return best;
};

const play = (state: BotState): BotAction | null => {
  const { G, ctx, playerID } = state;

  if (ctx.activePlayers?.[playerID] !== 'domesticTurn') return null;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('domestic')) {
    return null;
  }

  const domestic = G.domestic;
  if (domestic === undefined) return null;

  // Step 1: produce first if we haven't yet this round and the grid is
  // non-empty (an empty grid produces nothing, no point spending the
  // move).
  if (
    domestic.producedThisRound !== true &&
    Object.keys(domestic.grid).length > 0
  ) {
    return { move: 'domesticProduce', args: [] };
  }

  const wallet = G.wallets[playerID];
  if (wallet === undefined) return null;

  // Step 2: sort hand by gold cost ascending; tie-break by name for
  // determinism.
  const sortedHand = [...domestic.hand].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return a.name.localeCompare(b.name);
  });

  for (const card of sortedHand) {
    if (!canAfford(wallet, { gold: card.cost })) continue;
    const cell = bestCellFor(domestic.grid, card);
    if (cell !== null) {
      return {
        move: 'domesticBuyBuilding',
        args: [card.name, cell.x, cell.y],
      };
    }
  }

  return null;
};

export const domesticBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
