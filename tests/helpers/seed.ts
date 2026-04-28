// Deterministic SettlementState seeds for tests that don't want to drive
// `setup()` through a full client.
//
// Today the only seed is `seedAfterChiefDistribution`, which models the
// moment after the Chief has emptied the bank into the action circles.
// Real circle/hand contents grow as later stages need them.

import type { SettlementState } from '../../src/game/types.ts';
import { assignRoles } from '../../src/game/roles.ts';
import { EMPTY_BAG } from '../../src/game/resources/types.ts';

const freshBag = () => ({ ...EMPTY_BAG });

export const seedAfterChiefDistribution = (
  partial?: Partial<SettlementState>,
): SettlementState => {
  const roleAssignments = assignRoles(2);

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) {
    hands[seat] = {};
  }

  const base: SettlementState = {
    bank: freshBag(), // bank fully distributed → empty
    centerMat: {}, // placeholder until 03.3 fills in the circles
    roleAssignments,
    round: 1, // post-distribution → past round 0 setup
    hands,
  };

  if (partial === undefined) return base;
  return { ...base, ...partial };
};
