// Tests for foreignRecruit (07.2).
//
// Driven by direct calls to the move function form against a hand-built
// SettlementState + stub Ctx, in the same style as the other 07.x and
// 05.x tests. The Foreign hand / inPlay / inFlight slots are seeded
// minimally per test so each assertion is local.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignRecruit } from '../../../src/game/roles/foreign/recruit.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { UNITS } from '../../../src/data/index.ts';
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

// Build a 2-player state where seat '1' holds domestic+foreign. Seeds the
// foreign seat's wallet from `walletOf` so the recruit move has gold to
// spend.
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
  // Seat '1' is the foreign seat in 2p.
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

const callRecruit = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  defID: string,
  count?: number,
): typeof INVALID_MOVE | void => {
  const mv = foreignRecruit as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    defID: string,
    count?: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, defID, count);
};

describe('foreignRecruit (07.2)', () => {
  it('happy path: recruit a Brute (cost 3); wallet -3, bank +3, inPlay count=1', () => {
    // Brute is the third UNITS entry with cost 3.
    const brute = UNITS.find((u) => u.name === 'Brute')!;
    expect(brute.cost).toBe(3);

    const G = build2pState({ gold: 5 });

    const result = callRecruit(G, '1', ctxForeignTurn('1'), 'Brute');

    expect(result).toBeUndefined();
    expect(G.wallets['1']).toEqual(bagOf({ gold: 2 }));
    expect(G.bank).toEqual(bagOf({ gold: 3 }));
    expect(G.foreign!.inPlay).toEqual([{ defID: 'Brute', count: 1 }]);
  });

  it('recruit twice: count goes to 2 with no duplicate UnitInstance', () => {
    const G = build2pState({ gold: 10 });

    callRecruit(G, '1', ctxForeignTurn('1'), 'Brute');
    callRecruit(G, '1', ctxForeignTurn('1'), 'Brute');

    expect(G.foreign!.inPlay).toEqual([{ defID: 'Brute', count: 2 }]);
    expect(G.wallets['1']).toEqual(bagOf({ gold: 4 }));
    expect(G.bank).toEqual(bagOf({ gold: 6 }));
  });

  it('Forge in domestic grid reduces unit cost by 1', () => {
    // Drop a Forge into the domestic grid. The Forge's benefit string
    // ("units cost 1 less") parses to a `unitCost: -1` BenefitEffect, so
    // recruiting a Brute should cost 2 gold instead of 3.
    const forgeBuilding: DomesticBuilding = {
      defID: 'Forge',
      upgrades: 0,
      worker: null,
    };
    const G = build2pState(
      { gold: 5 },
      {
        domestic: {
          hand: [],
          grid: { '0,0': forgeBuilding },
        },
      },
    );

    const result = callRecruit(G, '1', ctxForeignTurn('1'), 'Brute');

    expect(result).toBeUndefined();
    expect(G.wallets['1']).toEqual(bagOf({ gold: 3 }));
    expect(G.bank).toEqual(bagOf({ gold: 2 }));
    expect(G.foreign!.inPlay).toEqual([{ defID: 'Brute', count: 1 }]);
  });
});
