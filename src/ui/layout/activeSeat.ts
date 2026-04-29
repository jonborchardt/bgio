// activeSeat (14.12) — pure helper picking the seat the bgio engine
// will actually accept moves from.
//
// Why this exists: the Board header used to read
// `Player ${ctx.currentPlayer + 1}'s turn`, but `ctx.currentPlayer`
// is bgio's "default seat" — it advances after every pass-style
// turn end and trails the actual active seat by an entire phase
// once `setActivePlayers` is in play. After the foreign seat ends
// round 0 in our 4-player game, the engine transitions back to
// `chiefPhase` for round 1; only the chief seat (Player 1) is
// active, but `currentPlayer` is still '3' — so the header used to
// (mis)read "Player 4's turn".
//
// The fix: when `activePlayers` is non-empty, prefer it as the
// source of truth. Skip seats parked in the `done` stage (they've
// already finished their work this phase). Pick the lowest seat id
// among the remaining active seats so the helper is stable. Fall
// back to `currentPlayer` only when `activePlayers` is null/empty.

import type { PlayerID, Role } from '../../game/types.ts';

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
  roleAssignments: Record<PlayerID, Role[]>;
  localSeat: PlayerID | null | undefined;
}): ActiveSeatInfo {
  const { activePlayers, currentPlayer, roleAssignments, localSeat } = args;

  let seat: PlayerID = currentPlayer;
  if (activePlayers && Object.keys(activePlayers).length > 0) {
    const candidates = Object.entries(activePlayers)
      .filter(([, stage]) => stage !== 'done')
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
