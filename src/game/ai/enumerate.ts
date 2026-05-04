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

  // chiefFlipTrack: when there's a card to flip and the round's flip
  // hasn't happened yet (D22). The move re-validates legality.
  if (
    G.track !== undefined &&
    G.track.upcoming.length > 0 &&
    G.track.flippedThisRound !== true
  ) {
    out.push({ move: 'chiefFlipTrack', args: [] });
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

  // scienceSeatDone: always a fallback so the bot can bail out cleanly.
  out.push({ move: 'scienceSeatDone', args: [] });

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
      // The center tile (D2) is not upgradeable / repairable — skip it in
      // both surfaces below so the bot doesn't keep trying a guaranteed
      // INVALID_MOVE.
      if (placed.isCenter === true) continue;
      out.push({
        move: 'domesticUpgradeBuilding',
        args: [x, y, placed.defID],
      });
      // domesticRepair (1.3): one candidate per damaged cell. The amount
      // is always 1 — chaining single-HP repairs reaches any larger
      // restoration, and the move bottoms out on `missing <= 0` so an
      // already-full cell harmlessly returns INVALID_MOVE.
      if (placed.hp < placed.maxHp) {
        out.push({
          move: 'domesticRepair',
          args: [x, y, 1],
        });
      }
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

  // domesticSeatDone: always a fallback.
  out.push({ move: 'domesticSeatDone', args: [] });

  return out;
};

const enumerateDefense = (G: SettlementState): MoveCandidate[] => {
  // 1.4 stub — the only defense action is ending the turn. Phase 2 will
  // add buy / place / play-tech candidates over the new economy.
  if (G.defense === undefined) return [];
  return [{ move: 'defenseSeatDone', args: [] }];
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
    } else if (stage === STAGES.defenseTurn && seatRoles.includes('defense')) {
      out.push(...enumerateDefense(G));
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
