// Tests for the resource spend helper `payFromStash`.
//
// Note: the older `pullFromMat` move was removed when the wallet/circle
// split collapsed into a single per-seat `mats[seat]` shape with
// engine-driven in→stash transfer. Spending now goes from
// `mats[seat].stash` into `G.bank` — covered here.

import { describe, expect, it } from 'vitest';
import { payFromStash } from '../../src/game/resources/moves.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { assignRoles } from '../../src/game/roles.ts';
import { initialMats } from '../../src/game/resources/playerMat.ts';
import type { ResourceBag } from '../../src/game/resources/types.ts';
import type { SettlementState } from '../../src/game/types.ts';

const build4pState = (
  bank: Partial<ResourceBag> = {},
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf(bank),
    centerMat: {},
    mats: initialMats(roleAssignments),
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
  };
};

describe('payFromStash', () => {
  it('debits the seat stash and credits the bank', () => {
    const G = build4pState({ gold: 0 });
    G.mats['1']!.stash = bagOf({ gold: 4, wood: 1 });

    payFromStash(G, '1', { gold: 3 });

    expect(G.mats['1']!.stash).toEqual(bagOf({ gold: 1, wood: 1 }));
    expect(G.bank).toEqual(bagOf({ gold: 3 }));
  });

  it('throws RangeError on underflow (caller converts to INVALID_MOVE)', () => {
    const G = build4pState({ gold: 0 });
    G.mats['1']!.stash = bagOf({ gold: 1 });

    expect(() => payFromStash(G, '1', { gold: 2 })).toThrow(RangeError);
  });

  it('throws on a seat with no mat (chief or absent)', () => {
    const G = build4pState();
    expect(() => payFromStash(G, '0', { gold: 1 })).toThrow(/no mat/);
    expect(() => payFromStash(G, '99', { gold: 1 })).toThrow(/no mat/);
  });
});
