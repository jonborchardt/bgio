// Tests for foreignUpkeep (07.2).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import {
  foreignUpkeep,
  computeForeignUpkeepGold,
  upkeepableUnits,
} from '../../../src/game/roles/foreign/upkeep.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { SettlementState, ForeignState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const build2pState = (
  stashOf: Partial<ResourceBag>,
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const mats = initialMats(roleAssignments);
  if (mats['1'] !== undefined) mats['1']!.stash = bagOf(stashOf);

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
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
  it('sufficient wallet: deducts ceil(cost/2) per in-play unit and credits the bank', () => {
    // Two Brutes (cost 3 → upkeep 2 each, x2 = 4) + one Scout (cost 2 →
    // upkeep 1, x1 = 1). Total upkeep 5 gold.
    const G = build2pState({ gold: 10 });
    G.foreign!.inPlay = [
      { defID: 'Brute', count: 2 },
      { defID: 'Scout', count: 1 },
    ];

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 5 }));
    expect(G.bank).toEqual(bagOf({ gold: 5 }));
    expect(G.foreign!._upkeepPaid).toBe(true);
  });

  it('insufficient wallet returns INVALID_MOVE; state unchanged', () => {
    const G = build2pState({ gold: 1 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 1 }]; // upkeep 2
    const before = JSON.parse(JSON.stringify(G));

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('units recruited this turn are exempt from upkeep', () => {
    // Two Brutes total, one of which was recruited this turn. Only the
    // pre-existing Brute owes upkeep (cost 3 → upkeep 2).
    const G = build2pState({ gold: 10 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 2 }];
    G.foreign!._recruitedThisTurn = { Brute: 1 };

    expect(computeForeignUpkeepGold(G)).toBe(2);
    expect(upkeepableUnits(G)).toEqual([{ defID: 'Brute', count: 1 }]);

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 8 }));
    expect(G.bank).toEqual(bagOf({ gold: 2 }));
  });

  it('all units recruited this turn → upkeep due is 0; move is a no-op pay that still flips _upkeepPaid', () => {
    const G = build2pState({ gold: 10 });
    G.foreign!.inPlay = [{ defID: 'Brute', count: 2 }];
    G.foreign!._recruitedThisTurn = { Brute: 2 };

    expect(computeForeignUpkeepGold(G)).toBe(0);

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 10 }));
    expect(G.foreign!._upkeepPaid).toBe(true);
  });

  it('Walls in domestic grid (unitMaintenance -2) reduces per-unit upkeep', () => {
    // Walls' benefit is "decrease unit maintenance by 2", parsed as
    // `unitMaintenance: -2`. With one Pikeman (cost 6 → baseUpkeep
    // ceil(6/2)=3) the per-unit upkeep becomes max(0, 3 - 2) = 1.
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
    G.foreign!.inPlay = [{ defID: 'Pikeman', count: 1 }];

    const result = callUpkeep(G, '1', ctxForeignTurn('1'));

    expect(result).toBeUndefined();
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 4 }));
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
  });
});
