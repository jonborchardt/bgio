// activeSeat (14.12) — pure helper picking the seat the bgio engine
// will actually accept moves from.
//
// Why this exists: the Board header used to read
// `Player ${ctx.currentPlayer + 1}'s turn`, but `ctx.currentPlayer`
// is bgio's "default seat" — it advances after every pass-style
// turn end and trails the actual active seat by an entire phase
// once `setActivePlayers` is in play. After the defense seat ends
// round 0 in our 4-player game, the engine transitions back to
// `chiefPhase` for round 1; only the chief seat (Player 1) is
// active, but `currentPlayer` is still '3' — so the header used to
// (mis)read "Player 4's turn".
//
// The fix: when `activePlayers` is non-empty, prefer it as the
// source of truth. Skip seats parked in the `done` stage (the chief
// is parked there for the whole `othersPhase`) AND seats whose
// `G.othersDone[seat]` flag is set (the 14.2 seatDone moves flip
// this without changing the stage map). Pick the lowest seat id
// among the remaining active seats so the helper is stable. Fall
// back to `currentPlayer` only when `activePlayers` is null/empty
// or every seat in it is already done.

import type { PlayerID, Role } from '../../game/types.ts';
import { seatOfRole } from '../../game/roles.ts';

export interface ActiveSeatInfo {
  seat: PlayerID;
  /** "Player N: <roles>" — mirrors the SeatPicker tab label format
   *  so the header and picker agree at a glance. */
  label: string;
  /** True iff the local viewer is the active seat — Board uses this
   *  to keep the header colored as `status.active` (and not the
   *  "you're spectating" muted tone). */
  isLocal: boolean;
}

const labelFor = (
  seat: PlayerID,
  roleAssignments: Record<PlayerID, Role[]>,
): string => {
  const roles = roleAssignments[seat] ?? [];
  return roles.length > 0
    ? `Player ${Number(seat) + 1}: ${roles.join(', ')}`
    : `Player ${Number(seat) + 1}`;
};

export function pickActiveSeat(args: {
  activePlayers: Record<PlayerID, string> | null | undefined;
  currentPlayer: PlayerID;
  /** Current bgio phase. In `chiefPhase` every seat is parked in
   *  `Stage.NULL` so non-chief seats can fire the side-channel
   *  `requestHelp` move — the actual phase-driver is the seat holding
   *  the chief role. Optional so pre-14.16 fixtures don't crash. */
  phase?: string | null;
  roleAssignments: Record<PlayerID, Role[]>;
  /** `G.othersDone` — seats with `true` here have flipped done in
   *  the current `othersPhase` (14.2's per-role seatDone moves) but
   *  remain in their original stage until the phase ends. The helper
   *  treats them as logically done. Optional so callers in pre-14.2
   *  fixtures don't crash. */
  othersDone?: Record<PlayerID, boolean> | undefined;
  localSeat: PlayerID | null | undefined;
}): ActiveSeatInfo {
  const {
    activePlayers,
    currentPlayer,
    phase,
    roleAssignments,
    othersDone,
    localSeat,
  } = args;

  let seat: PlayerID = currentPlayer;
  // chiefPhase: pin to the chief seat. bgio's default turn.order
  // rotates `currentPlayer` across phase transitions, so by the time
  // chiefPhase begins it can point at any seat — and the Stage.NULL
  // parking on every seat means the activePlayers fallback would also
  // mis-pick a non-chief.
  if (phase === 'chiefPhase') {
    try {
      seat = seatOfRole(roleAssignments, 'chief');
    } catch {
      // fall through to activePlayers / currentPlayer
    }
  } else if (activePlayers && Object.keys(activePlayers).length > 0) {
    const candidates = Object.entries(activePlayers)
      .filter(([s, stage]) => stage !== 'done' && !(othersDone?.[s] === true))
      .map(([s]) => s)
      .sort();
    if (candidates.length > 0) {
      seat = candidates[0]!;
    }
  }

  return {
    seat,
    label: labelFor(seat, roleAssignments),
    isLocal: localSeat !== undefined && localSeat !== null && localSeat === seat,
  };
}
