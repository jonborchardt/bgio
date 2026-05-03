// clearRequestsForTarget — remove every HelpRequest tied to a target id.
//
// Called from the completion sites (scienceComplete, domesticBuyBuilding,
// foreignRecruit, *PlayTech, foreignTradeFulfill) so a request auto-
// disappears the moment the requester actually performs the action,
// regardless of how the inputs got there.

import type { SettlementState } from '../types.ts';
import type { RequestTargetId } from './types.ts';

export const clearRequestsForTarget = (
  G: SettlementState,
  targetId: RequestTargetId,
): void => {
  if (G.requests === undefined || G.requests.length === 0) return;
  G.requests = G.requests.filter((r) => r.targetId !== targetId);
};
