// Tests for domesticUpgradeBuilding (06.2).
//
// V1 stub: upgrade increments the building's `upgrades` counter and charges
// `floor(originalDef.cost * 0.5)` gold. `upgradeCardName` is accepted but
// not validated against any registry.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticUpgradeBuilding } from '../../../src/game/roles/domestic/upgrade.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { BUILDINGS } from '../../../src/data/index.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type {
  DomesticState,
  SettlementState,
} from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import { cellKey } from '../../../src/game/roles/domestic/grid.ts';

// 2-player layout: seat '1' = domestic+foreign.
const build2pState = (
  walletOf: Partial<ResourceBag>,
  domestic: DomesticState,
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
    hands,
    wallets,
    domestic,
  };
};

const ctxDomesticTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'domesticTurn' },
  }) as unknown as Ctx;

const callUpgrade = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  x: number,
  y: number,
  upgradeCardName: string,
): typeof INVALID_MOVE | void => {
  const mv = domesticUpgradeBuilding as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    x: number,
    y: number,
    upgradeCardName: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, x, y, upgradeCardName);
};

describe('domesticUpgradeBuilding (06.2)', () => {
  it('increments the upgrades counter and deducts delta cost (50% floor)', () => {
    // Mill has cost 13 → delta = floor(13 * 0.5) = 6.
    const mill = BUILDINGS.find((b) => b.name === 'Mill')!;
    expect(mill.cost).toBe(13);

    const placed: DomesticBuilding = {
      defID: 'Mill',
      upgrades: 0,
      worker: null,
    };
    const G = build2pState(
      { gold: 20 },
      {
        hand: [],
        grid: { [cellKey(2, 3)]: placed },
      },
    );

    const result = callUpgrade(G, '1', ctxDomesticTurn('1'), 2, 3, 'Mill+');

    expect(result).toBeUndefined();
    // Counter bumped.
    expect(G.domestic!.grid[cellKey(2, 3)]!.upgrades).toBe(1);
    // Delta cost = 6 gold transferred wallet → bank.
    expect(G.wallets['1']).toEqual(bagOf({ gold: 14 }));
    expect(G.bank).toEqual(bagOf({ gold: 6 }));
  });

  it('returns INVALID_MOVE when upgrading an empty cell', () => {
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: {},
      },
    );

    const result = callUpgrade(G, '1', ctxDomesticTurn('1'), 0, 0, 'whatever');

    expect(result).toBe(INVALID_MOVE);
    // Nothing changed.
    expect(G.wallets['1']).toEqual(bagOf({ gold: 50 }));
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.grid).toEqual({});
  });
});
