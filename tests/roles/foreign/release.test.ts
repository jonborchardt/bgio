// Tests for foreignReleaseUnit (07.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignReleaseUnit } from '../../../src/game/roles/foreign/release.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { SettlementState, ForeignState } from '../../../src/game/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const build2pState = (
  walletOf: Partial<ResourceBag>,
  bankOf: Partial<ResourceBag>,
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const mats = initialMats(roleAssignments);
  if (mats['1'] !== undefined) mats['1']!.stash = bagOf(walletOf);

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf(bankOf),
    centerMat: { tradeRequest: null },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats,
    foreign: emptyForeign(),
    ...partial,
  };
};

const ctxForeignTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'foreignTurn' },
  }) as unknown as Ctx;

const callRelease = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  defID: string,
  count?: number,
): typeof INVALID_MOVE | void => {
  const mv = foreignReleaseUnit as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    defID: string,
    count?: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, defID, count);
};

describe('foreignReleaseUnit (07.2)', () => {
  it('release a Brute returns floor(3/2)=1 to the wallet, decrements count', () => {
    // Two Brutes in play; release one. Bank holds 5 gold so the refund
    // (1 gold) has somewhere to come from.
    const G = build2pState({ gold: 0 }, { gold: 5 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 2 }];

    const result = callRelease(G, '1', ctxForeignTurn('1'), 'Brute');

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 1 }));
    expect(G.bank).toEqual(bagOf({ gold: 4 }));
    expect(G.foreign!.inPlay).toEqual([{ defID: 'Brute', count: 1 }]);
  });

  it('release proceeds with a clamped refund when the bank cannot cover it', () => {
    // Bank empty: release must still succeed (it's the escape hatch when
    // upkeep is unaffordable). Player gets whatever the bank can pay — 0
    // here — and the unit is removed.
    const G = build2pState({ gold: 0 }, { gold: 0 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 1 }];

    const result = callRelease(G, '1', ctxForeignTurn('1'), 'Brute');

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 0 }));
    expect(G.bank).toEqual(bagOf({ gold: 0 }));
    expect(G.foreign!.inPlay).toEqual([]);
    expect(G.foreign!._lastRelease).toEqual({
      defID: 'Brute',
      count: 1,
      refundTotal: 0,
    });
  });
});
