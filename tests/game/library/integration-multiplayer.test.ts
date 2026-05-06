// SL fix-1 — multi-player Library buy integration.
//
// Parametrizes a buy across `[1, 2, 3, 4]` players. In 1p / 2p / 3p
// layouts, seat `'0'` is the science seat and is also the chief seat —
// `mats[scienceSeat]` is therefore undefined, and the buy must charge
// `G.bank` directly. In 4p, seat `'1'` is science and pays from its
// dedicated stash. The card lands in the recipient hand either way.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceLibraryBuy } from '../../../src/game/roles/science/libraryBuy.ts';
import { assignRoles, seatOfRole } from '../../../src/game/roles.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';
import { emptyLibraryState } from '../../../src/game/library/state.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

// Green T1 building costs 4 wood. We keep stash / bank wide so the
// floor-1 / discount math doesn't intrude on this routing test.
const greenT1: LibraryCard = {
  kind: 'building',
  tier: 1,
  scienceColor: 'green',
  def: {
    name: 'Mill',
    cost: 0,
    benefit: '',
    note: '',
    maxHp: 1,
    tier: 1,
    scienceColor: 'green',
  },
};

const buildState = (numPlayers: 1 | 2 | 3 | 4): SettlementState => {
  const roleAssignments = assignRoles(numPlayers);
  const mats = initialMats(roleAssignments);
  const scienceSeat = seatOfRole(roleAssignments, 'science');

  // 4p: science seat has its own mat; fund that stash. 1-3p: science is
  // chief — `mats[scienceSeat]` is undefined; fund `G.bank` instead so
  // the bank-fallback path has resources.
  const hasMat = mats[scienceSeat] !== undefined;
  if (hasMat) {
    mats[scienceSeat] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf({ wood: 50 }),
    };
  }

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const seats = Object.keys(roleAssignments);
  const lib = emptyLibraryState(seats);
  lib.row[0] = greenT1;

  return {
    bank: bagOf(hasMat ? {} : { wood: 50 }),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: { hand: [] },
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [], techHand: [] },
    chief: { workers: 0, hand: [] },
    library: lib,
  };
};

const callBuy = (
  G: SettlementState,
  playerID: string,
  slot: number,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBuy as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: ctxScienceTurn(playerID), playerID }, slot);
};

describe('scienceLibraryBuy — multiplayer parametric', () => {
  for (const numPlayers of [1, 2, 3, 4] as const) {
    it(`${numPlayers}p: buy lands in recipient hand and deducts from the right pool`, () => {
      const G = buildState(numPlayers);
      const scienceSeat = seatOfRole(G.roleAssignments, 'science');

      const matBefore = G.mats[scienceSeat];
      const stashWoodBefore = matBefore?.stash.wood ?? 0;
      const bankWoodBefore = G.bank.wood ?? 0;

      const result = callBuy(G, scienceSeat, 0);
      expect(result).toBeUndefined();

      // Card landed in domestic.hand regardless of player count — green
      // routes to domestic.
      expect(G.domestic!.hand).toHaveLength(1);
      expect(G.domestic!.hand[0]!.name).toBe('Mill');

      // Tableau grew and slot is now empty.
      expect(G.library!.discountTableaus[scienceSeat]).toHaveLength(1);
      expect(G.library!.row[0]).toBeNull();

      if (matBefore !== undefined) {
        // 4p: stash drops by 4; bank gains 4.
        expect(G.mats[scienceSeat]!.stash.wood).toBe(stashWoodBefore - 4);
        expect(G.bank.wood).toBe(bankWoodBefore + 4);
      } else {
        // 1-3p: bank-fallback path. Bank drops by 4; no mat exists for
        // the science seat so there's nothing to compare on the stash side.
        expect(G.bank.wood).toBe(bankWoodBefore - 4);
        expect(G.mats[scienceSeat]).toBeUndefined();
      }
    });
  }

  it('1p: buy is rejected when bank cannot afford it', () => {
    const G = buildState(1);
    G.bank = bagOf({ wood: 1 });
    const result = callBuy(G, '0', 0);
    expect(result).toBe(INVALID_MOVE);
    expect(G.bank.wood).toBe(1);
    expect(G.library!.row[0]).not.toBeNull();
  });
});
