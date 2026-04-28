// Pure role-assignment helpers. No boardgame.io imports.
//
// The mapping from player-count to seat -> roles is fixed by
// game-design.md §Players. See plans/01.1-state-shape.md for the
// canonical table this file encodes.

import type { PlayerID, Role } from './types.ts';

type NumPlayers = 1 | 2 | 3 | 4;

const ASSIGNMENTS: Record<NumPlayers, Record<PlayerID, Role[]>> = {
  1: {
    '0': ['chief', 'science', 'domestic', 'foreign'],
  },
  2: {
    '0': ['chief', 'science'],
    '1': ['domestic', 'foreign'],
  },
  3: {
    '0': ['chief', 'science'],
    '1': ['domestic'],
    '2': ['foreign'],
  },
  4: {
    '0': ['chief'],
    '1': ['science'],
    '2': ['domestic'],
    '3': ['foreign'],
  },
};

/**
 * Returns the canonical seat -> roles mapping for the given player count.
 * Throws on out-of-range values.
 *
 * The returned object is a fresh shallow clone (with cloned role arrays)
 * so callers may freely mutate it without disturbing the lookup table.
 */
export function assignRoles(numPlayers: 1 | 2 | 3 | 4): Record<PlayerID, Role[]> {
  const table = ASSIGNMENTS[numPlayers];
  if (!table) {
    throw new Error(
      `assignRoles: numPlayers must be 1, 2, 3, or 4 (got ${String(numPlayers)})`,
    );
  }
  const out: Record<PlayerID, Role[]> = {};
  for (const [seat, roles] of Object.entries(table)) {
    out[seat] = [...roles];
  }
  return out;
}

/**
 * Finds the unique seat that holds the given role.
 * Throws if the role is missing or held by more than one seat.
 */
export function seatOfRole(
  assignments: Record<PlayerID, Role[]>,
  role: Role,
): PlayerID {
  const matches: PlayerID[] = [];
  for (const [seat, roles] of Object.entries(assignments)) {
    if (roles.includes(role)) matches.push(seat);
  }
  if (matches.length === 0) {
    throw new Error(`seatOfRole: no seat holds role '${role}'`);
  }
  if (matches.length > 1) {
    throw new Error(
      `seatOfRole: role '${role}' is held by multiple seats: ${matches.join(', ')}`,
    );
  }
  return matches[0]!;
}

/**
 * Returns the roles held by `seat`, or `[]` if the seat is not present.
 */
export function rolesAtSeat(
  assignments: Record<PlayerID, Role[]>,
  seat: PlayerID,
): Role[] {
  const roles = assignments[seat];
  return roles ? [...roles] : [];
}
