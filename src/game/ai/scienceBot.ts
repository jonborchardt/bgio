// Issue 004 — `scienceBot.play()` for solo + idle-takeover bot wiring.
//
// The science seat's main lever is the Library: scan `G.library.row`,
// pick the cheapest affordable card whose discount-tableau path actually
// helps the seat (matching color), and route through
// `scienceLibraryBuy`. When nothing is affordable, the bot falls back to
// `scienceLibraryBurn` to clear the once-per-round burn requirement
// (`scienceSeatDone` rejects until the burn latch is set), choosing the
// highest-tier slot so the burned card is least likely to be researchable
// anyway.
//
// We mirror `domesticBot`'s structure: a single move per call, returning
// `null` when nothing legal exists (the composed bot then falls through
// to the next role or to the harness's seat-done flow).

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import { canAffordFromStashOrBank } from '../resources/moves.ts';
import { effectiveResearchCost } from '../library/costs.ts';
import { RESOURCES } from '../resources/types.ts';
import type { ResourceBag } from '../resources/types.ts';
import type { MoveCandidate } from './enumerate.ts';
import type { LibraryCard } from '../library/types.ts';

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

/** Total resources in a cost bag — used to sort affordable buys cheapest-
 *  first when no other tiebreaker applies. */
const sumCost = (cost: ResourceBag): number => {
  let total = 0;
  for (const r of RESOURCES) total += cost[r] ?? 0;
  return total;
};

interface CandidateBuy {
  slotIndex: number;
  card: LibraryCard;
  cost: ResourceBag;
  costSum: number;
}

const play = (state: BotState): MoveCandidate | null => {
  const { G, ctx, playerID } = state;

  if (ctx.activePlayers?.[playerID] !== 'scienceTurn') return null;
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('science')) return null;

  const lib = G.library;
  if (lib === undefined) return null;

  const tableau = lib.discountTableaus[playerID] ?? [];

  const affordable: CandidateBuy[] = [];
  for (let slotIndex = 0; slotIndex < lib.row.length; slotIndex++) {
    const card = lib.row[slotIndex];
    if (card === null || card === undefined) continue;
    const cost = effectiveResearchCost(card, tableau);
    if (!canAffordFromStashOrBank(G, playerID, cost)) continue;
    affordable.push({
      slotIndex,
      card,
      cost,
      costSum: sumCost(cost),
    });
  }

  if (affordable.length > 0) {
    // Prefer cheaper buys; tie-break by tier ascending (build the discount
    // ladder bottom-up) and then slot index for determinism.
    affordable.sort((a, b) => {
      if (a.costSum !== b.costSum) return a.costSum - b.costSum;
      if (a.card.tier !== b.card.tier) return a.card.tier - b.card.tier;
      return a.slotIndex - b.slotIndex;
    });
    return {
      move: 'scienceLibraryBuy',
      args: [affordable[0]!.slotIndex],
    };
  }

  // Nothing affordable. Satisfy the once-per-round burn requirement so
  // `scienceSeatDone` can fire afterwards. Pick the highest-tier
  // remaining slot — the most expensive card is the least likely to be
  // affordable on later turns either, so burning it costs the table the
  // least. Tie-break by slot index for determinism.
  if (G.science?.scienceBurnedThisRound === true) return null;
  let pick: { slotIndex: number; tier: number } | null = null;
  for (let slotIndex = 0; slotIndex < lib.row.length; slotIndex++) {
    const card = lib.row[slotIndex];
    if (card === null || card === undefined) continue;
    if (pick === null || card.tier > pick.tier) {
      pick = { slotIndex, tier: card.tier };
    }
  }
  if (pick === null) return null;
  return { move: 'scienceLibraryBurn', args: [pick.slotIndex] };
};

export const scienceBot: { play: (state: BotState) => MoveCandidate | null } = {
  play,
};
