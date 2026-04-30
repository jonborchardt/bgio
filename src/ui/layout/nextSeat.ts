// Hot-seat helpers for picking which seat the local viewer should
// swap to after a seat ends its turn.
//
// Used by the four role panels' End-my-turn handlers to drive
// `SeatPickerContext.setSeat(...)` after dispatching the seat-done /
// chief-end-phase move. Networked mode never invokes these (the
// SeatPickerContext is undefined there) so per-seat play is unaffected.

import type { PlayerID, SettlementState } from '../../game/types.ts';
import { rolesAtSeat, seatOfRole } from '../../game/roles.ts';

/**
 * Picks the seat the local viewer should swap to after `justFinished`
 * completes its turn in `othersPhase`. Iterates seats in id order and
 * returns the first non-chief seat that is not the seat that just
 * finished and has not already flipped `G.othersDone[seat] === true`.
 * If every other non-chief seat is already done, returns the chief
 * seat — once the seat-done move resolves, `othersPhase.endIf` fires
 * and the engine transitions to `endOfRound` -> `chiefPhase`.
 */
export function nextSeatAfterDone(
  G: SettlementState,
  justFinished: PlayerID,
): PlayerID {
  const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
  const seats = Object.keys(G.roleAssignments).sort();
  const next = seats.find((s) => {
    if (s === justFinished) return false;
    if (s === chiefSeat) return false;
    if (G.othersDone?.[s] === true) return false;
    if (rolesAtSeat(G.roleAssignments, s).length === 0) return false;
    return true;
  });
  return next ?? chiefSeat;
}

/**
 * Picks the seat the local viewer should swap to when the chief ends
 * their phase. The next phase is `othersPhase`; we advance to the
 * lowest-numbered non-chief seat with at least one role.
 */
export function firstNonChiefSeat(G: SettlementState): PlayerID {
  const chiefSeat = seatOfRole(G.roleAssignments, 'chief');
  const seats = Object.keys(G.roleAssignments).sort();
  const next = seats.find((s) => {
    if (s === chiefSeat) return false;
    if (rolesAtSeat(G.roleAssignments, s).length === 0) return false;
    return true;
  });
  return next ?? chiefSeat;
}
