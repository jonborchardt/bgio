// 11.4 — ScienceBot.
//
// Pure heuristic for the Science role. Greedy strategy:
//   1. Find the lowest-level non-completed card per color column (this
//      is the only one the contribute / complete moves accept).
//   2. If any of those is paid-off AND the per-round completion limit
//      hasn't been hit, complete it.
//   3. Otherwise: find the card with the smallest *remaining* cost (sum
//      of cost - paid across all resources). If the stash has any of
//      those resources, contribute 1 unit of one resource at a time.
//   4. Else: nothing to do — return null.
//
// The bot returns one move per call; the caller chains repeated calls
// to drain the stash into the cheapest reachable card. Single-resource
// increments keep the move's parameter shape simple and avoid having
// to compute multi-resource bundles up-front.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import { RESOURCES } from '../resources/types.ts';
import type { Resource } from '../resources/types.ts';
import type { ScienceCardDef } from '../../data/scienceCards.ts';
import type { MoveCandidate } from './enumerate.ts';

export type BotAction = MoveCandidate;

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

/**
 * For each color column, return the lowest-level non-completed card —
 * those are the only ones contribute / complete will accept.
 */
const lowestPerColumn = (G: SettlementState): ScienceCardDef[] => {
  const science = G.science;
  if (science === undefined) return [];
  const out: ScienceCardDef[] = [];
  for (const column of science.grid) {
    let best: ScienceCardDef | undefined;
    for (const c of column) {
      if (science.completed.includes(c.id)) continue;
      if (best === undefined || c.level < best.level) best = c;
    }
    if (best !== undefined) out.push(best);
  }
  return out;
};

/** Sum of remaining cost across all resources for a card. */
const remainingCost = (
  card: ScienceCardDef,
  paid: Record<Resource, number>,
): number => {
  let sum = 0;
  for (const r of RESOURCES) {
    const need = card.cost[r] ?? 0;
    const have = paid[r] ?? 0;
    const left = need - have;
    if (left > 0) sum += left;
  }
  return sum;
};

/**
 * Whether `paid` already covers `card.cost` (every resource).
 */
const isPaidOff = (
  card: ScienceCardDef,
  paid: Record<Resource, number>,
): boolean => {
  for (const r of RESOURCES) {
    const need = card.cost[r] ?? 0;
    const have = paid[r] ?? 0;
    if (have < need) return false;
  }
  return true;
};

const play = (state: BotState): BotAction | null => {
  const { G, ctx, playerID } = state;

  // Stage gate: only act in `scienceTurn` for a science seat.
  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return null;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) {
    return null;
  }

  const science = G.science;
  if (science === undefined) return null;

  const reachable = lowestPerColumn(G);
  if (reachable.length === 0) return null;

  // Step 1: complete a paid-off card if the per-round cap isn't hit.
  if (science.perRoundCompletions < 1) {
    // Sort by id so ties resolve deterministically.
    const sorted = [...reachable].sort((a, b) => a.id.localeCompare(b.id));
    for (const card of sorted) {
      const paid = science.paid[card.id];
      if (paid === undefined) continue;
      if (isPaidOff(card, paid)) {
        return { move: 'scienceComplete', args: [card.id] };
      }
    }
  }

  // Step 2: contribute one resource toward the card with the smallest
  // remaining cost. We only consider cards that still need something
  // AND for which the stash has at least one of the needed resources.
  const stash = G.mats?.[playerID]?.stash;
  if (stash === undefined) return null;

  // Find the card with the smallest remaining cost (>0). Tie-break by id.
  const candidates = reachable
    .map((card) => ({ card, remaining: remainingCost(card, science.paid[card.id] ?? makeZeroBag()) }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return a.card.id.localeCompare(b.card.id);
    });

  for (const { card } of candidates) {
    const paid = science.paid[card.id] ?? makeZeroBag();
    // Pick a resource we have AND that the card still needs. Iterate in
    // RESOURCES order for deterministic selection.
    for (const r of RESOURCES) {
      const need = card.cost[r] ?? 0;
      const have = paid[r] ?? 0;
      const left = need - have;
      if (left <= 0) continue;
      if ((stash[r] ?? 0) <= 0) continue;
      return {
        move: 'scienceContribute',
        args: [card.id, { [r]: 1 }],
      };
    }
  }

  return null;
};

const makeZeroBag = (): Record<Resource, number> => ({
  gold: 0,
  wood: 0,
  stone: 0,
  steel: 0,
  horse: 0,
  food: 0,
  production: 0,
  science: 0,
  happiness: 0,
  worker: 0,
});

export const scienceBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
