// Build the request slices for an action whose only blocker is a
// resource shortfall payable from someone else's pool. The chief is
// the recipient (chief sends resources; other players can't directly
// give resources to one another).
//
// Returns an empty array when nothing is short — the helper button uses
// that to decide whether to render itself.

import type { PlayerID, Role, SettlementState } from '../../game/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { seatOfRole } from '../../game/roles.ts';
import { computeShortfall, isEmptyBag } from '../../game/requests/blockers.ts';
import type { RequestSlice } from '../../game/requests/move.ts';

export interface ResourceSliceArgs {
  G: SettlementState;
  /** The seat that would be performing the action. */
  fromSeat: PlayerID;
  /** The seat's role (chief / science / domestic / defense). */
  fromRole: Role;
  /** What the action would charge. */
  cost: Partial<ResourceBag>;
  /** What the requester has on hand (stash for non-chief; bank for chief). */
  have: ResourceBag | undefined;
}

export function buildResourceSlices({
  G,
  fromSeat,
  fromRole,
  cost,
  have,
}: ResourceSliceArgs): RequestSlice[] {
  if (have === undefined) return [];
  const shortfall = computeShortfall(have, cost);
  if (isEmptyBag(shortfall)) return [];
  // Chief is the only player who can mint resources for others. If the
  // local seat IS the chief, there's no one to ask — return empty.
  if (fromRole === 'chief') return [];
  let chiefSeat: PlayerID;
  try {
    chiefSeat = seatOfRole(G.roleAssignments, 'chief');
  } catch {
    return [];
  }
  // 1/2/3-player layouts collapse multiple roles onto one seat. When
  // the requester's seat ALSO holds chief, there's no peer to ask
  // (the same seat is both giver and receiver).
  if (chiefSeat === fromSeat) return [];
  return [
    {
      toSeat: chiefSeat,
      need: { kind: 'resources', bag: shortfall },
    },
  ];
}
