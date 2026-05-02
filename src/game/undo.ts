// Generic snapshot-based undo for "play a card or recruit" moves.
//
// One snapshot slot lives on G (`_lastAction`). The undoable moves
// (foreignRecruit, foreignReleaseUnit, domesticBuyBuilding, the four
// `<role>PlayTech` moves, the four `<role>PlayEvent` moves) deep-clone G
// before they mutate it via `markUndoable`. The single `undoLast` move
// restores from that clone.
//
// The rule "1 undo, lost when you play another card" is enforced by:
//   1. `markUndoable` clears any prior `_lastAction` *before* taking the
//      snapshot, so a chained snapshot never carries an older undo with it.
//   2. Every other state-mutating move calls `clearUndoable` after its
//      validation passes — so a non-undoable action (upkeep, distribute,
//      flip, contribute, assign damage, …) also wipes the undo. Without
//      that, restoring the snapshot would silently roll back state those
//      moves had already changed.
//
// Why the snapshot stores a *full* G clone rather than per-seat slices:
// the moves we cover touch shared state (`bank`, `bankLog`, `_modifiers`,
// `events.cycles`, …) plus per-seat state, and reversing event/tech
// effects is fundamentally as expensive as cloning. The "any state
// change clears the undo" rule sidesteps the parallel-actives problem
// (Seat A's snapshot would otherwise lose Seat B's interleaved changes).
//
// `bgio`'s built-in `UNDO` action is unusable here: bgio's master rejects
// UNDO whenever multiple players are simultaneously active via
// `setActivePlayers`, which is exactly our `othersPhase` setup.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { PlayerID, SettlementState } from './types.ts';

export interface UndoSnapshot {
  /** Deep-cloned G as it was right before the move's mutations. */
  state: SettlementState;
  /** Human-readable label for the Undo button (e.g. "Recruit Scout"). */
  label: string;
  /** Seat that took the action — only this seat may call `undoLast`. */
  seat: PlayerID;
}

/**
 * Snapshot G into `G._lastAction` so the action that follows can be
 * undone via `undoLast`. Call this *after* the move's validation has
 * passed and *before* it mutates G.
 *
 * Drops any prior `_lastAction` first so the snapshot we take next
 * doesn't carry a stale older snapshot with it (a restore would otherwise
 * re-arm an undo for an even older action).
 */
export const markUndoable = (
  G: SettlementState,
  label: string,
  seat: PlayerID,
): void => {
  G._lastAction = undefined;
  // Inside a bgio move G is an Immer draft; JSON serialization yields the
  // raw underlying values, and JSON.parse rebuilds them as plain objects
  // we can assign back into the draft on undo.
  const state = JSON.parse(JSON.stringify(G)) as SettlementState;
  G._lastAction = { state, label, seat };
};

/**
 * Drop any pending undo. Called by every non-undoable state-mutating
 * move so that restoring an older snapshot can't quietly roll back the
 * move's effects.
 */
export const clearUndoable = (G: SettlementState): void => {
  if (G._lastAction !== undefined) G._lastAction = undefined;
};

/**
 * Restore the seat's most recent snapshot. INVALID_MOVE if no snapshot
 * exists or the snapshot belongs to another seat.
 *
 * Implementation: walk the top-level keys of G and the snapshot, deleting
 * keys that don't exist in the snapshot and assigning every snapshot key
 * back into G. Immer turns this into a clean diff.
 */
export const undoLast: Move<SettlementState> = ({ G, ctx, playerID }) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  const lastAction = G._lastAction;
  if (lastAction === undefined) return INVALID_MOVE;
  if (lastAction.seat !== playerID) return INVALID_MOVE;
  // If the prior move pushed the seat into the `playingEvent` interrupt
  // stage (e.g. a tech effect that needs follow-up input), we'd need to
  // unwind bgio's stage too. Skip that edge case for V1.
  if (ctx.activePlayers?.[playerID] === 'playingEvent') return INVALID_MOVE;

  const snapshot = lastAction.state;
  const draft = G as unknown as Record<string, unknown>;
  for (const key of Object.keys(draft)) {
    if (!(key in snapshot)) delete draft[key];
  }
  for (const [key, value] of Object.entries(snapshot)) {
    draft[key] = value;
  }
  // Belt + suspenders: the snapshot is taken with `_lastAction` cleared,
  // but make doubly sure no chained undo can fire.
  G._lastAction = undefined;
};
