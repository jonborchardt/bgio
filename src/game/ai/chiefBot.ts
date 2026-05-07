// 11.3 — ChiefBot.
//
// Pure heuristic bot for the Chief role. Returns at most one move per call
// (or `null` when there's nothing the bot wants to do — the caller is then
// expected to flip whatever seat-done flag the harness uses).
//
// The bot keeps it simple by design:
//   1. Distribute resources from the bank toward the seat that has the
//      most demand. We send 1 gold per call so the caller can chain
//      repeated bot.play(...) invocations to drain the bank monotonically
//      — each call re-evaluates demand against the updated state.
//   2. If the bank is empty or no other seat shows demand, end the
//      chief phase.
//
// The "demand" model is intentionally rough: domestic demand is the
// cheapest hand BuildingDef cost, science demand is the cheapest research
// cost across face-up Library slots, defense demand is currently 0 (Phase
// 2 will add the real recruit / placement loop and re-introduce per-
// defense-seat demand). The bot only routes gold — chief distribution
// of other resources is reserved for a future heuristic.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat, seatOfRole } from '../roles.ts';
import type { MoveCandidate } from './enumerate.ts';
import type { LibraryCard } from '../library/types.ts';
import { researchCost } from '../library/costs.ts';

export type BotAction = MoveCandidate;

interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

const tryChiefSeat = (G: SettlementState): PlayerID | null => {
  try {
    return seatOfRole(G.roleAssignments, 'chief');
  } catch {
    return null;
  }
};

const domesticDemandAt = (G: SettlementState): number => {
  const domestic = G.domestic;
  if (domestic === undefined) return 0;
  let cheapest = Number.POSITIVE_INFINITY;
  for (const def of domestic.hand) {
    // Defensive: redacted views can leave null entries in hands, and
    // a bot driven against a server-redacted snapshot shouldn't
    // crash on a null member. Authoritative bots see the full hand;
    // this guard is the test-harness safety net.
    if (def && def.cost < cheapest) cheapest = def.cost;
  }
  return Number.isFinite(cheapest) ? cheapest : 0;
};

// Library cost includes a primary research resource that isn't always
// gold; for the chief's gold-routing heuristic we only count the
// printed gold demand of the cheapest face-up slot.
const goldCostFor = (card: LibraryCard): number => {
  const cost = researchCost(card);
  return cost.gold ?? 0;
};

const scienceDemandAt = (G: SettlementState): number => {
  const library = G.library;
  if (library === undefined) return 0;
  let smallest = Number.POSITIVE_INFINITY;
  for (const slot of library.row) {
    if (slot === null || slot === undefined) continue;
    const need = goldCostFor(slot);
    if (need > 0 && need < smallest) smallest = need;
  }
  return Number.isFinite(smallest) ? smallest : 0;
};

interface SeatDemand {
  seat: PlayerID;
  amount: number;
}

const seatDemands = (
  G: SettlementState,
  chiefSeat: PlayerID,
): SeatDemand[] => {
  const out: SeatDemand[] = [];
  // Iterate seats by sorted PlayerID so ties resolve deterministically
  // (PlayerID is the seat string '0' .. '3').
  const seats = Object.keys(G.roleAssignments).sort();
  for (const seat of seats) {
    if (seat === chiefSeat) continue;
    // Skip seats that don't own a player mat — chief can't drop tokens
    // there and `chiefDistribute` rejects no-mat targets.
    if (!G.mats?.[seat]) continue;
    const roles = rolesAtSeat(G.roleAssignments, seat);
    let amount = 0;
    if (roles.includes('domestic')) amount += domesticDemandAt(G);
    if (roles.includes('science')) amount += scienceDemandAt(G);
    // 1.4: defense demand is 0 until Phase 2 reintroduces recruit costs.
    out.push({ seat, amount });
  }
  return out;
};

const endPhase = (): BotAction => ({ move: 'chiefEndPhase', args: [] });

// Issue 036 — Tax thresholds. Tax is the chief's primary lever
// post-defense-redesign; a bot that never reaches for it understates
// the chief's capability and biases win-rate measurements. We fire
// Tax once per round when bank gold is low AND at least one
// non-chief seat has hoarded enough that the haul (the floor-half
// summed across seats) clears `TAX_MIN_HAUL_THRESHOLD`.
const TAX_BANK_GOLD_THRESHOLD = 4;
const TAX_MIN_HAUL_THRESHOLD = 3;

const seatStashHaul = (G: SettlementState, seat: PlayerID): number => {
  const stash = G.mats?.[seat]?.stash;
  if (!stash) return 0;
  let total = 0;
  for (const r of Object.keys(stash)) {
    const v = (stash as Record<string, number | undefined>)[r] ?? 0;
    if (v > 1) total += Math.floor(v / 2);
  }
  return total;
};

const totalTaxableHaul = (G: SettlementState, chiefSeat: PlayerID): number => {
  let total = 0;
  for (const seat of Object.keys(G.roleAssignments)) {
    if (seat === chiefSeat) continue;
    if (rolesAtSeat(G.roleAssignments, seat).includes('chief')) continue;
    total += seatStashHaul(G, seat);
  }
  return total;
};

const shouldTax = (G: SettlementState, chiefSeat: PlayerID): boolean => {
  if (G.chief?.taxedThisRound === true) return false;
  const bankGold = G.bank.gold ?? 0;
  if (bankGold > TAX_BANK_GOLD_THRESHOLD) return false;
  return totalTaxableHaul(G, chiefSeat) >= TAX_MIN_HAUL_THRESHOLD;
};

const play = (state: BotState): BotAction | null => {
  const { G, ctx, playerID } = state;

  // Phase / role gate: only act in chiefPhase from the chief seat.
  if (ctx.phase !== 'chiefPhase') return null;
  const chiefSeat = tryChiefSeat(G);
  if (chiefSeat === null || chiefSeat !== playerID) return null;

  // Issue 036 — Tax first when the bank's bare and the room has
  // hoarded enough to make the haul worthwhile.
  if (shouldTax(G, chiefSeat)) {
    return { move: 'chiefTax', args: [] };
  }

  // Empty bank → nothing left to distribute. End the phase, but only if
  // the round's track flip has happened — otherwise flip first (D22).
  const bankGold = G.bank.gold ?? 0;
  if (bankGold <= 0) {
    if (
      G.track !== undefined &&
      G.track.flippedThisRound !== true &&
      G.track.upcoming.length > 0
    ) {
      return { move: 'chiefFlipTrack', args: [] };
    }
    return endPhase();
  }

  // Find the seat with maximum demand. Ties broken by sorted seat order
  // (set up in `seatDemands` already).
  const demands = seatDemands(G, chiefSeat);
  let best: SeatDemand | null = null;
  for (const d of demands) {
    if (d.amount <= 0) continue;
    if (best === null || d.amount > best.amount) best = d;
  }

  if (best === null) {
    // No other seat needs anything → just end the phase. Flip the
    // track first if we haven't this round.
    if (
      G.track !== undefined &&
      G.track.flippedThisRound !== true &&
      G.track.upcoming.length > 0
    ) {
      return { move: 'chiefFlipTrack', args: [] };
    }
    return endPhase();
  }

  // Send 1 gold per call to the highest-demand seat. The caller drains
  // the bank by re-invoking `play` until it returns chiefEndPhase.
  return {
    move: 'chiefDistribute',
    args: [best.seat, { gold: 1 }],
  };
};

export const chiefBot: { play: (state: BotState) => BotAction | null } = {
  play,
};
