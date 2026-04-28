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

  // Wallets default to one empty bag per non-chief seat — matches `setup`
  // (chief has no wallet entry). Tests that need pre-credited wallets pass
  // a `wallets` slice via `partial`.
  const wallets: Record<string, ReturnType<typeof freshBag>> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) wallets[seat] = freshBag();
  }

  const base: SettlementState = {
    bank: freshBag(), // bank fully distributed → empty
    centerMat: { circles: {}, tradeRequest: null }, // empty mat — tests that need circles set them via partial
    roleAssignments,
    round: 1, // post-distribution → past round 0 setup
    hands,
    wallets,
  };

  if (partial === undefined) return base;
  return { ...base, ...partial };
};
