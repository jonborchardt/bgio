// requestHelp — toggle a help request for a target action.
//
// Payload: a list of `{ toSeat, need }` slices, one per recipient. The
// caller (UI) computes the slices from the blocker; the engine just
// stores or removes the rows. Toggle semantics:
//   - If a row from `playerID` for `targetId` to that recipient already
//     exists, remove it (rescind).
//   - Otherwise insert a fresh row.
//
// When a click yields multiple recipients, each is toggled independently
// — the typical case (all rows in the same state) means they all flip
// together, which is what users expect.

import type { Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { PlayerID, Role, SettlementState } from '../types.ts';
import { rolesAtSeat } from '../roles.ts';
import type { HelpRequest, RequestNeed, RequestTargetId } from './types.ts';

export interface RequestSlice {
  toSeat: PlayerID;
  need: RequestNeed;
}

export interface RequestHelpPayload {
  fromRole: Role;
  targetId: RequestTargetId;
  targetLabel: string;
  slices: RequestSlice[];
}

const composeId = (
  fromSeat: PlayerID,
  toSeat: PlayerID,
  targetId: RequestTargetId,
): string => `${fromSeat}|${toSeat}|${targetId}`;

export const requestHelp: Move<SettlementState> = (
  { G, playerID },
  payload: RequestHelpPayload,
) => {
  if (playerID === undefined || playerID === null) return INVALID_MOVE;
  if (payload === undefined || payload === null) return INVALID_MOVE;

  const { fromRole, targetId, targetLabel, slices } = payload;
  if (typeof targetId !== 'string' || targetId.length === 0) return INVALID_MOVE;
  if (typeof targetLabel !== 'string') return INVALID_MOVE;
  if (!Array.isArray(slices) || slices.length === 0) return INVALID_MOVE;

  // Caller must actually hold the role they're claiming as the asker.
  // Prevents a network adversary from spoofing "Science is asking…".
  if (!rolesAtSeat(G.roleAssignments, playerID).includes(fromRole)) {
    return INVALID_MOVE;
  }

  if (G.requests === undefined) G.requests = [];

  for (const slice of slices) {
    if (slice === undefined || slice === null) continue;
    const { toSeat, need } = slice;
    if (typeof toSeat !== 'string' || toSeat.length === 0) continue;
    // No self-requests — a player can't ask themselves for help. (The
    // chief asking the chief for resources is the obvious case.)
    if (toSeat === playerID) continue;

    const id = composeId(playerID, toSeat, targetId);
    const existingIdx = G.requests.findIndex((r) => r.id === id);
    if (existingIdx >= 0) {
      G.requests.splice(existingIdx, 1);
      continue;
    }
    const fresh: HelpRequest = {
      id,
      fromSeat: playerID,
      fromRole,
      toSeat,
      targetId,
      targetLabel,
      need,
      round: G.round,
    };
    G.requests.push(fresh);
  }
};
