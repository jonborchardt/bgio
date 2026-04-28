// Tests for foreignUpkeep (07.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignUpkeep } from '../../../src/game/roles/foreign/upkeep.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { SettlementState, ForeignState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const build2pState = (
  walletOf: Partial<ResourceBag>,
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const matCircles: Record<string, ResourceBag> = {};
  const wallets: Record<string, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      matCircles[seat] = bagOf({});
      wallets[seat] = bagOf({});
    }
  }
  wallets['1'] = bagOf(walletOf);

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: { circles: matCircles, tradeRequest: null },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    wallets,
    foreign: emptyForeign(),
    ...partial,
  };
};

const ctxForeignTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'foreignTurn' },
  }) as unknown as Ctx;

const callUpkeep = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
): typeof INVALID_MOVE | void => {
  const mv = foreignUpkeep as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('foreignUpkeep (07.2)', () => {
  it('sufficient wallet: deducts def.cost per in-play unit and credits the bank', () => {
    // Two Brutes (cost 3 each) and one Scout (cost 2): total upkeep 8 gold.
    const G = build2pState({ gold: 10 });
    G.foreign!.inPlay = [
      { defID: 'Brute', count: 2 },
      { defID: 'Scout', count: 1 },
    ];

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.wallets['1']).toEqual(bagOf({ gold: 2 }));
    expect(G.bank).toEqual(bagOf({ gold: 8 }));
    expect(G.foreign!._upkeepPaid).toBe(true);
  });

  it('insufficient wallet returns INVALID_MOVE; state unchanged', () => {
    const G = build2pState({ gold: 1 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 1 }]; // upkeep 3
    const before = JSON.parse(JSON.stringify(G));

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('Walls in domestic grid (unitMaintenance -2) reduces per-unit upkeep', () => {
    // Walls' benefit is "decrease unit maintenance by 2", parsed as
    // `unitMaintenance: -2`. With one Brute (cost 3) the per-unit upkeep
    // becomes max(0, 3 - 2) = 1.
    const walls: DomesticBuilding = {
      defID: 'Walls',
      upgrades: 0,
      worker: null,
    };
    const G = build2pState(
      { gold: 5 },
      {
        domestic: {
          hand: [],
          grid: { '0,0': walls },
        },
      },
    );
    G.foreign!.inPlay = [{ defID: 'Brute', count: 1 }];

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.wallets['1']).toEqual(bagOf({ gold: 4 }));
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
  });
});
