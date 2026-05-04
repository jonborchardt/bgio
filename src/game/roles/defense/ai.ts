// Defense redesign 2.5 — defense bot enumerator + composed bot.
//
// `enumerateDefense` returns the candidate move list for `playerID` when
// they sit in the `defenseTurn` stage. Used by the central
// `src/game/ai/enumerate.ts` (RandomBot / MCTSBot via `Game.ai.enumerate`)
// and by `defenseBot.play` (solo bot dispatcher in `src/lobby/soloConfig.ts`).
//
// Heuristic priorities:
//   1. `defenseSeatDone` is always offered last (the bot can always
//      bail out cleanly).
//   2. `defenseBuyAndPlace`: one candidate per (unit in hand × placeable
//      tile). We skip cards the seat can't afford and skip the center
//      tile. To keep the candidate list manageable we score each
//      placement by "covers any tile on the path of the telegraphed
//      next track card" — placements that *cover* the next-card's path
//      are preferred and surfaced first; placements that don't cover
//      the next path are still emitted (so MCTS / RandomBot can
//      explore them) but only when no covering placement exists.
//   3. `defensePlay`: one candidate per playable red tech in techHand.
//      Trivial enumerator — the move's args ergonomics differ per
//      effect kind, so we only emit args-less candidates for kinds
//      that support that shape (peek / demote). Targeted kinds
//      (swap / unitUpgrade) need a target picker that's beyond the
//      naive bot's scope; we skip them rather than emit invalid
//      candidates.
//
// Determinism: candidate order is stable across runs. We sort the
// firing-tile pool by Manhattan distance to the path's first cell so
// the topmost / leftmost covering tile leads.

import type { Ctx } from 'boardgame.io';
import type { PlayerID, SettlementState } from '../../types.ts';
import { rolesAtSeat } from '../../roles.ts';
import type { MoveCandidate } from '../../ai/enumerate.ts';
import { canAfford } from '../../resources/bag.ts';
import { unitCost } from '../../../data/index.ts';
import { peekNext } from '../../track.ts';
import {
  computeGridBounds,
  computePath,
  parseCellKey,
  tileCoversPath,
  type Cell,
} from '../../track/path.ts';

export interface BotState {
  G: SettlementState;
  ctx: Ctx;
  playerID: PlayerID;
}

/**
 * Bounded enumerator for the defense seat. Returns an empty list when
 * the seat isn't in `defenseTurn` or doesn't hold the role — the
 * caller (the central enumerate dispatch) handles role / stage gating
 * before invoking us, but we re-check defensively so the function is
 * usable from tests that synthesize a state directly.
 */
export const enumerateDefense = (
  G: SettlementState,
  ctx: Ctx,
  playerID: PlayerID,
): MoveCandidate[] => {
  const out: MoveCandidate[] = [];
  if (!rolesAtSeat(G.roleAssignments, playerID).includes('defense')) {
    return out;
  }
  if (ctx.activePlayers?.[playerID] !== 'defenseTurn') return out;
  const defense = G.defense;
  if (defense === undefined) return out;

  const stash = G.mats?.[playerID]?.stash;

  // Compute the telegraphed next card's path (when it's a threat).
  // `tileCoversPath` reads the unit's tile + range against this path;
  // when no threat is telegraphed, every placement is equivalent for
  // path-coverage purposes, and the bot falls through to "any
  // affordable placement is fine."
  const grid = G.domestic?.grid ?? {};
  const next = G.track !== undefined ? peekNext(G.track) : undefined;
  const nextPath: Cell[] =
    next !== undefined && next.kind === 'threat'
      ? computePath(next.direction, next.offset, computeGridBounds(grid))
      : [];

  // Build a deterministic, pre-filtered pool of placement cells: only
  // placed (non-center) buildings on the domestic grid. Sort by `(y, x)`
  // so the topmost-leftmost option leads; ties between identical
  // placements stay stable.
  const placementCells: string[] = [];
  for (const key of Object.keys(grid)) {
    const cell = grid[key];
    if (cell === undefined || cell.isCenter === true) continue;
    placementCells.push(key);
  }
  placementCells.sort((a, b) => {
    const pa = parseCellKey(a);
    const pb = parseCellKey(b);
    if (pa === null && pb === null) return a.localeCompare(b);
    if (pa === null) return 1;
    if (pb === null) return -1;
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.x - pb.x;
  });

  // Buy + place candidates. We bucket by "covers next-card path" so
  // covering placements appear before non-covering ones — RandomBot
  // picks uniformly across the list, but MCTS sees the strong moves
  // surface first when scoring.
  const covering: MoveCandidate[] = [];
  const nonCovering: MoveCandidate[] = [];
  for (const def of defense.hand) {
    if (stash === undefined || !canAfford(stash, unitCost(def))) continue;
    for (const cellKey of placementCells) {
      const tile = parseCellKey(cellKey);
      if (tile === null) continue;
      const covers =
        nextPath.length > 0 && tileCoversPath(tile, def.range, nextPath);
      const cand: MoveCandidate = {
        move: 'defenseBuyAndPlace',
        args: [def.name, cellKey],
      };
      if (covers) covering.push(cand);
      else nonCovering.push(cand);
    }
  }
  // When a threatened path exists and at least one placement covers
  // it, prefer covering placements; otherwise emit everything so the
  // bot has options on quiet turns.
  if (nextPath.length > 0 && covering.length > 0) {
    out.push(...covering);
  } else {
    out.push(...covering, ...nonCovering);
  }

  // Tech plays. We emit args-less candidates for non-targeted effects
  // (peekTrack / demoteTrack); targeted effects (unitUpgrade / swap)
  // need a target picker that's beyond the naive enumerator's scope
  // — we skip them rather than emit candidates that the move would
  // reject.
  for (const tech of defense.techHand ?? []) {
    const effects = tech.onPlayEffects;
    if (effects === undefined || effects.length === 0) continue;
    const isTargeted = effects.some(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        ((e as { kind?: string }).kind === 'unitUpgrade' ||
          (e as { kind?: string }).kind === 'swapTrackInPhase'),
    );
    if (isTargeted) continue;
    out.push({ move: 'defensePlay', args: [tech.name] });
  }

  // End-my-turn always available — bgio re-evaluates the phase's
  // endIf after the move and transitions when every non-chief seat
  // has flipped done.
  out.push({ move: 'defenseSeatDone', args: [] });

  return out;
};

/**
 * Composed `play(state)` adapter for the solo-mode bot map (see
 * `src/lobby/soloConfig.ts`). Picks the *first* candidate from
 * `enumerateDefense`. Higher-quality picks (e.g. weighting by
 * affordability + path coverage) are a future MCTS / scored-bot
 * pass; the V1 bot just plays the first plausible move so the round
 * advances.
 */
const play = (state: BotState): MoveCandidate | null => {
  const candidates = enumerateDefense(state.G, state.ctx, state.playerID);
  // Filter out the trivial `defenseSeatDone` so we only end the turn
  // when there's nothing else to do. The composed bot returns null
  // when it can't act; `soloConfig.buildBotMap` interprets that as
  // "fall through to seat-done" via the seat-done bot in the role-bots
  // map. Today defenseBot is the only bot for the defense role, so we
  // do the seat-done gate here.
  const nonTrivial = candidates.filter(
    (c) => c.move !== 'defenseSeatDone',
  );
  if (nonTrivial.length > 0) return nonTrivial[0]!;
  return candidates[candidates.length - 1] ?? null;
};

export const defenseAi: { play: (state: BotState) => MoveCandidate | null } = {
  play,
};
