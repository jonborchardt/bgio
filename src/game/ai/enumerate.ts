// 11.2 — `enumerate(G, ctx, playerID)` for bgio's MCTSBot.
//
// MCTS asks `enumerate` for the legal moves available to `playerID` at a
// given state. We don't try to be *exhaustively* correct — the move bodies
// already enforce legality and reject illegal calls with `INVALID_MOVE`.
// What this enumerator owes the bot is a reasonable, small set of *plausible*
// candidates so MCTS doesn't burn the search budget on no-ops.
//
// The output also doubles as the source for RandomBot's pool when the
// engine config wires `ai: { enumerate }` on the Game (RandomBot calls
// `enumerate` via the same hook). RandomBot picks uniformly across this
// list, so keeping it small and on-distribution helps random play be
// vaguely sensible too.
//
// Combinatoric blow-up control: we cap the total candidate count at
// MAX_CANDIDATES and, for moves that take a Partial<ResourceBag>, only
// enumerate single-resource increments of 1. That's enough granularity for
// MCTS to find the right *direction* — multi-resource bundles can be
// reached by chaining single-resource calls when the game allows partial
// credit.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../types.ts';
import type { Resource } from '../resources/types.ts';
import { rolesAtSeat, seatOfRole } from '../roles.ts';
import { STAGES } from '../phases/stages.ts';

export interface MoveCandidate {
  move: string;
  args: unknown[];
}

const MAX_CANDIDATES = 50;

// Single-resource amounts the bot can try distributing / contributing.
// Keeping this tight avoids combinatoric blow-up — chaining unit moves
// reaches the same multi-resource bundles when the game allows partial
// credit.
const SINGLE_RESOURCE_BUMPS: ReadonlyArray<Resource> = [
  'gold',
  'wood',
  'stone',
  'food',
  'production',
  'science',
];

const tryChiefSeat = (G: SettlementState): PlayerID | null => {
  try {
    return seatOfRole(G.roleAssignments, 'chief');
  } catch {
    return null;
  }
};

const enumerateChief = (
  G: SettlementState,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];

  // chiefDistribute: one candidate per (target seat × single-resource +1).
  // Targets are every non-chief seat with a player mat.
  const targets = Object.keys(G.mats ?? {}).filter(
    (seat) => seat !== playerID,
  );
  for (const target of targets) {
    for (const r of SINGLE_RESOURCE_BUMPS) {
      if ((G.bank[r] ?? 0) <= 0) continue;
      out.push({
        move: 'chiefDistribute',
        args: [target, { [r]: 1 }],
      });
    }
  }

  // chiefEndPhase: always a candidate while in chiefPhase.
  out.push({ move: 'chiefEndPhase', args: [] });

  // chiefPlaceWorker: a few cell candidates, gated by feature flag and
  // available workers. We don't try every cell — MCTS can re-enumerate after
  // each placement and pick another.
  if (
    G._features?.workersEnabled === true &&
    (G.chief?.workers ?? 0) > 0 &&
    G.domestic?.grid !== undefined
  ) {
    const cells = Object.keys(G.domestic.grid).slice(0, 4);
    for (const key of cells) {
      const cell = G.domestic.grid[key];
      if (cell === undefined || cell.worker !== null) continue;
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        out.push({ move: 'chiefPlaceWorker', args: [{ x, y }] });
      }
    }
  }

  // chiefPlayGoldEvent: one candidate per card in the chief's gold hand,
  // assuming the chief hasn't already played a gold event this round.
  if (
    G.events !== undefined &&
    G._eventPlayedThisRound?.chief !== true
  ) {
    const goldHand = G.events.hands.gold[playerID] ?? [];
    for (const card of goldHand) {
      out.push({ move: 'chiefPlayGoldEvent', args: [card.id] });
    }
  }

  // chiefDecideTradeDiscard: only legal when the flag is on, but no harm
  // listing both choices when it is.
  if (G._awaitingChiefTradeDiscard === true) {
    out.push({ move: 'chiefDecideTradeDiscard', args: ['existing'] });
    out.push({ move: 'chiefDecideTradeDiscard', args: ['new'] });
  }

  // foreignTradeFulfill: chief-only (see tradeFulfill.ts) — the chief
  // pays `required` from `G.bank` and receives `reward` back, ticking
  // `settlementsJoined` toward the win condition.
  if (G.centerMat.tradeRequest !== null) {
    out.push({ move: 'foreignTradeFulfill', args: [] });
  }

  // chiefPlayTech: one candidate per tech in the chief's hand with a non-
  // empty onPlayEffects.
  const chiefTechHand = G.chief?.hand ?? [];
  for (const tech of chiefTechHand) {
    if (tech.onPlayEffects !== undefined && tech.onPlayEffects.length > 0) {
      out.push({ move: 'chiefPlayTech', args: [tech.name] });
    }
  }

  return out;
};

const enumerateScience = (
  G: SettlementState,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  const science = G.science;
  if (science === undefined) return out;

  const stash = G.mats?.[playerID]?.stash;

  // scienceContribute: one candidate per uncomplete card × {gold:1} or
  // {wood:1}. Skip cards already completed.
  const flatCards = science.grid.flat();
  for (const card of flatCards) {
    if (science.completed.includes(card.id)) continue;
    for (const r of ['gold', 'wood'] as const) {
      if (stash === undefined || (stash[r] ?? 0) <= 0) continue;
      out.push({ move: 'scienceContribute', args: [card.id, { [r]: 1 }] });
    }
  }

  // scienceComplete: candidate for every uncomplete card whose paid covers
  // its cost (cheap to check; the move re-validates).
  for (const card of flatCards) {
    if (science.completed.includes(card.id)) continue;
    const paid = science.paid[card.id];
    if (paid === undefined) continue;
    let covers = true;
    for (const [r, need] of Object.entries(card.cost) as Array<
      [Resource, number]
    >) {
      if ((paid[r] ?? 0) < (need ?? 0)) {
        covers = false;
        break;
      }
    }
    if (covers) {
      out.push({ move: 'scienceComplete', args: [card.id] });
    }
  }

  // sciencePlayBlueEvent: one candidate per card in the science seat's blue
  // hand, gated by the per-round flag.
  if (
    G.events !== undefined &&
    G._eventPlayedThisRound?.science !== true
  ) {
    const blueHand = G.events.hands.blue[playerID] ?? [];
    for (const card of blueHand) {
      out.push({ move: 'sciencePlayBlueEvent', args: [card.id] });
    }
  }

  // sciencePlayTech: per-tech candidates with non-empty onPlayEffects.
  for (const tech of science.hand) {
    if (tech.onPlayEffects !== undefined && tech.onPlayEffects.length > 0) {
      out.push({ move: 'sciencePlayTech', args: [tech.name] });
    }
  }

  return out;
};

const enumerateDomestic = (
  G: SettlementState,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  const domestic = G.domestic;
  if (domestic === undefined) return out;

  // domesticBuyBuilding: one candidate per (hand card × placement cell). The
  // cell pool is small for legibility — origin + a handful of nearby cells.
  // The buy move re-validates adjacency / occupancy / affordability.
  const placementCells: ReadonlyArray<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  for (const def of domestic.hand) {
    for (const cell of placementCells) {
      out.push({
        move: 'domesticBuyBuilding',
        args: [def.name, cell.x, cell.y],
      });
    }
  }

  // domesticUpgradeBuilding: one candidate per existing cell.
  for (const key of Object.keys(domestic.grid)) {
    const [xs, ys] = key.split(',');
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const placed = domestic.grid[key]!;
      out.push({
        move: 'domesticUpgradeBuilding',
        args: [x, y, placed.defID],
      });
    }
  }

  // domesticProduce: a single candidate (no args). Idempotency is gated by
  // the move itself — a second call returns INVALID_MOVE.
  out.push({ move: 'domesticProduce', args: [] });

  // domesticPlayGreenEvent: one candidate per card in the domestic green
  // hand.
  if (
    G.events !== undefined &&
    G._eventPlayedThisRound?.domestic !== true
  ) {
    const greenHand = G.events.hands.green[playerID] ?? [];
    for (const card of greenHand) {
      out.push({ move: 'domesticPlayGreenEvent', args: [card.id] });
    }
  }

  // domesticPlayTech.
  for (const tech of domestic.techHand ?? []) {
    if (tech.onPlayEffects !== undefined && tech.onPlayEffects.length > 0) {
      out.push({ move: 'domesticPlayTech', args: [tech.name] });
    }
  }

  return out;
};

const enumerateForeign = (
  G: SettlementState,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  const foreign = G.foreign;
  if (foreign === undefined) return out;

  // foreignRecruit: one candidate per UnitDef in the hand.
  for (const def of foreign.hand) {
    out.push({ move: 'foreignRecruit', args: [def.name] });
  }

  // foreignUpkeep: a single candidate (no args). Idempotency gated by the
  // move's per-stage `_upkeepPaid` flag.
  out.push({ move: 'foreignUpkeep', args: [] });

  // foreignReleaseUnit: one candidate per in-play entry.
  for (const entry of foreign.inPlay) {
    out.push({ move: 'foreignReleaseUnit', args: [entry.defID] });
  }

  // foreignFlipBattle: a single candidate. The move rejects when there's
  // already a battle in flight or the deck is empty.
  out.push({ move: 'foreignFlipBattle', args: [] });

  // foreignFlipTrade: only legal after a winning battle, but listing it
  // costs nothing — the move rejects when not.
  out.push({ move: 'foreignFlipTrade', args: [] });

  // foreignPlayRedEvent.
  if (
    G.events !== undefined &&
    G._eventPlayedThisRound?.foreign !== true
  ) {
    const redHand = G.events.hands.red[playerID] ?? [];
    for (const card of redHand) {
      out.push({ move: 'foreignPlayRedEvent', args: [card.id] });
    }
  }

  // foreignPlayTech. Red techs distributed by 05.3 live in
  // `foreign.techHand` (separate from `foreign.hand`, which holds
  // recruitable units).
  for (const tech of foreign.techHand ?? []) {
    if ((tech.onPlayEffects?.length ?? 0) > 0) {
      out.push({ move: 'foreignPlayTech', args: [tech.name] });
    }
  }

  return out;
};

const enumeratePlayingEvent = (
  G: SettlementState,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  const effect = G._awaitingInput?.[playerID];

  if (effect?.kind === 'swapTwoScienceCards' && G.science !== undefined) {
    // Generate a small number of (a, b) candidate pairs so MCTS has
    // *something* to branch on. We only take the first few science cards;
    // a 9-card grid has 36 distinct pairs — too many to enumerate without
    // exploding the candidate count.
    const cards = G.science.grid.flat();
    const ids = cards.map((c) => c.id).slice(0, 4);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        out.push({
          move: 'eventResolve',
          args: [{ a: ids[i]!, b: ids[j]! }],
        });
      }
    }
  } else {
    // For any other parked effect (or `awaitInput`), an empty-payload
    // resolve is the catch-all — the dispatcher accepts it and pops the
    // stage.
    out.push({ move: 'eventResolve', args: [undefined] });
  }

  return out;
};

const enumerateForeignAwaitingDamage = (
  G: SettlementState,
): MoveCandidate[] => {
  const foreign = G.foreign;
  if (foreign === undefined) return [];

  // V1: a single auto-allocation candidate. The DamageAllocation
  // shape (07.3 battleResolver) is `{ byUnit: Record<defID, number> }`,
  // not `{ sourceIdx, targetIdx, amount }`. The resolver consumes
  // one allocation per incoming-damage event from enemy → player, so
  // the simplest plan that doesn't deadlock the bot is "absorb the
  // first hit by piling damage onto the lowest-HP committed unit".
  // The resolver rejects under-allocations with `outcome: 'mid'` and
  // assignDamage converts that to INVALID_MOVE, which is fine — MCTS
  // collapses the branch and the foreignBot heuristic picks up next.
  if (foreign.inFlight.committed.length === 0) return [];
  const first = foreign.inFlight.committed[0];
  if (first === undefined) return [];
  return [
    {
      move: 'foreignAssignDamage',
      args: [[{ byUnit: { [first.defID]: 1 } }]],
    },
  ];
};

/**
 * Inspects `ctx.phase` and `ctx.activePlayers?.[playerID]` and returns a
 * bounded list of plausible move candidates for `playerID`. `pass` is
 * always included as a fallback so the bot has *something* legal to try.
 */
export const enumerate = (
  G: SettlementState,
  ctx: Ctx,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  const stage = ctx.activePlayers?.[playerID];
  const isChiefSeat = playerID === tryChiefSeat(G);
  const seatRoles = rolesAtSeat(G.roleAssignments, playerID);

  if (ctx.phase === 'chiefPhase' && isChiefSeat) {
    out.push(...enumerateChief(G, playerID));
  } else if (ctx.phase === 'othersPhase') {
    if (stage === STAGES.scienceTurn && seatRoles.includes('science')) {
      out.push(...enumerateScience(G, playerID));
    } else if (stage === STAGES.domesticTurn && seatRoles.includes('domestic')) {
      out.push(...enumerateDomestic(G, playerID));
    } else if (stage === STAGES.foreignTurn && seatRoles.includes('foreign')) {
      out.push(...enumerateForeign(G, playerID));
    } else if (stage === STAGES.foreignAwaitingDamage) {
      out.push(...enumerateForeignAwaitingDamage(G));
    } else if (stage === STAGES.playingEvent) {
      out.push(...enumeratePlayingEvent(G, playerID));
    }
  } else if (stage === STAGES.playingEvent) {
    // Defensive: a `playingEvent` interrupt could fire from any phase.
    out.push(...enumeratePlayingEvent(G, playerID));
  }

  // Always include pass as a fallback — guarantees the candidate list is
  // non-empty so the bot has at least one legal action to try.
  out.push({ move: 'pass', args: [] });

  // Cap at MAX_CANDIDATES. The pass fallback is appended last, so if we
  // overshoot it's the bulk of the role-specific list that gets trimmed —
  // which is fine: MCTS doesn't need *every* candidate, just a fair
  // sample.
  if (out.length > MAX_CANDIDATES) {
    return [...out.slice(0, MAX_CANDIDATES - 1), { move: 'pass', args: [] }];
  }
  return out;
};
