// Stage definitions and helpers for `othersPhase` (02.2).
//
// `othersPhase` runs every non-chief seat in parallel via bgio's
// `setActivePlayers` map. Each seat sits in the stage matching their
// primary non-chief role (science > domestic > defense), and any role
// can briefly pivot into the shared `playingEvent` stage to resolve an
// event card without losing their place — `enterEventStage` /
// `exitEventStage` push and pop the prior stage on a per-seat stack
// kept on `G._stageStack`.

import type { PlayerID, Role, SettlementState } from '../types.ts';
import { seatOfRole } from '../roles.ts';

export const STAGES = {
  scienceTurn: 'scienceTurn',
  domesticTurn: 'domesticTurn',
  defenseTurn: 'defenseTurn',
  playingEvent: 'playingEvent',
  done: 'done',
} as const;

export type StageName = typeof STAGES[keyof typeof STAGES];

// Priority order for seats that hold more than one non-chief role
// (game-design.md §Players 1–3p). Higher index = lower priority.
type NonChiefRole = Exclude<Role, 'chief'>;

const NON_CHIEF_PRIORITY: ReadonlyArray<NonChiefRole> = [
  'science',
  'domestic',
  'defense',
];

const ROLE_TO_STAGE: Record<NonChiefRole, StageName> = {
  science: STAGES.scienceTurn,
  domestic: STAGES.domesticTurn,
  defense: STAGES.defenseTurn,
};

/**
 * Builds the bgio `setActivePlayers({ value })` map for `othersPhase`
 * from the live role assignments:
 *   - chief seat → `done` (chief has already resolved their phase).
 *   - every other seat → the stage matching their highest-priority
 *     non-chief role, by `science > domestic > defense`.
 *
 * Pure: no boardgame.io imports, no mutation of `assignments`.
 */
export const activePlayersForOthers = (
  assignments: Record<PlayerID, Role[]>,
): Record<PlayerID, StageName> => {
  const chiefSeat = seatOfRole(assignments, 'chief');
  const out: Record<PlayerID, StageName> = {};
  for (const [seat, roles] of Object.entries(assignments)) {
    if (seat === chiefSeat) {
      out[seat] = STAGES.done;
      continue;
    }
    const primary = NON_CHIEF_PRIORITY.find((r) => roles.includes(r));
    if (primary === undefined) {
      // No non-chief roles at this seat — nothing to do this phase.
      out[seat] = STAGES.done;
      continue;
    }
    out[seat] = ROLE_TO_STAGE[primary];
  }
  return out;
};

// ---------------------------------------------------------------------------
// Event-stage stack helpers.
//
// The plan's signatures took `(events, returnTo)` but the stack lives on
// G, which `events` doesn't expose. Reshaped to the bgio move-arg shape
// `({ G, events })` (the helper itself takes them as positional args so
// callers from inside a move body just spread their own `({ G, events,
// playerID })` arguments through).
//
// `playerID` is the acting seat — bgio passes it on the move ctx; the
// caller threads it through so the helpers don't need to peek at
// `ctx.currentPlayer` (which is meaningless under stages).
// ---------------------------------------------------------------------------

// Minimal subset of bgio's `Events` API we need. Typed locally so the
// helpers don't need to depend on bgio's internal type paths (those
// aren't part of the package's public surface and shift between
// versions).
export interface StageEvents {
  setStage: (stage: string) => void;
}

/**
 * Pushes the seat's current stage onto `G._stageStack[playerID]` and
 * transitions the seat into the shared `playingEvent` stage. The
 * caller passes `returnTo` — typically the seat's current stage as
 * read from `ctx.activePlayers?.[playerID]` — because bgio doesn't
 * expose the stage to the helper directly.
 */
export const enterEventStage = (
  G: SettlementState,
  playerID: PlayerID,
  events: StageEvents,
  returnTo: StageName,
): void => {
  if (!G._stageStack) G._stageStack = {};
  const stack = G._stageStack[playerID] ?? [];
  stack.push(returnTo);
  G._stageStack[playerID] = stack;
  events.setStage(STAGES.playingEvent);
};

/**
 * Pops the seat's most recently pushed stage off `G._stageStack` and
 * sets the bgio stage back to it. Throws `RangeError` if the stack is
 * empty (or absent) — that signals a logic bug in whoever called this
 * without a matching `enterEventStage`.
 */
export const exitEventStage = (
  G: SettlementState,
  playerID: PlayerID,
  events: StageEvents,
): void => {
  const stack = G._stageStack?.[playerID];
  if (!stack || stack.length === 0) {
    throw new RangeError(
      `exitEventStage: stage stack underflow for player '${playerID}'`,
    );
  }
  const prev = stack.pop()!;
  events.setStage(prev);
};
