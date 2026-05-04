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
// cheapest hand BuildingDef cost, science demand is the smallest remaining
// gold cost across non-completed cards, defense demand is currently 0
// (Phase 2 will add the real recruit / placement loop and re-introduce
// per-defense-seat demand). The bot only routes gold — chief distribution
// of other resources is reserved for a future heuristic.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import { rolesAtSeat, seatOfRole } from '../roles.ts';
import type { MoveCandidate } from './enumerate.ts';

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
    if (def.cost < cheapest) cheapest = def.cost;
  }
  return Number.isFinite(cheapest) ? cheapest : 0;
};

const scienceDemandAt = (G: SettlementState): number => {
  const science = G.science;
  if (science === undefined) return 0;
  let smallest = Number.POSITIVE_INFINITY;
  for (const card of science.grid.flat()) {
    if (science.completed.includes(card.id)) continue;
    const paid = science.paid[card.id];
    const need = card.cost.gold ?? 0;
    const haveGold = paid?.gold ?? 0;
    const remaining = Math.max(0, need - haveGold);
    if (remaining > 0 && remaining < smallest) smallest = remaining;
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

const play = (state: BotState): BotAction | null => {
  const { G, ctx, playerID } = state;

  // Phase / role gate: only act in chiefPhase from the chief seat.
  if (ctx.phase !== 'chiefPhase') return null;
  const chiefSeat = tryChiefSeat(G);
  if (chiefSeat === null || chiefSeat !== playerID) return null;

  // Empty bank → nothing to distribute, end phase.
  const bankGold = G.bank.gold ?? 0;
  if (bankGold <= 0) return endPhase();

  // Find the seat with maximum demand. Ties broken by sorted seat order
  // (set up in `seatDemands` already).
  const demands = seatDemands(G, chiefSeat);
  let best: SeatDemand | null = null;
  for (const d of demands) {
    if (d.amount <= 0) continue;
    if (best === null || d.amount > best.amount) best = d;
  }

  if (best === null) {
    // No other seat needs anything → just end the phase.
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
