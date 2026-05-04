// Tests for domesticBuyBuilding (06.2).
//
// Driven by direct calls to the move function form against a hand-built
// SettlementState + stub Ctx, in the same style as the other 06.x / 07.x
// move tests. Each case seeds the minimum slice of state it needs.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticBuyBuilding } from '../../../src/game/roles/domestic/buy.ts';
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
import { initialMats } from '../../../src/game/resources/playerMat.ts';

// 2-player layout: seat '0' = chief+science, seat '1' = domestic+defense.
const build2pState = (
  walletOf: Partial<ResourceBag>,
  domestic: DomesticState,
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const mats = initialMats(roleAssignments);
  if (mats['1'] !== undefined) mats['1']!.stash = bagOf(walletOf);

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
    domestic,
  };
};

const ctxDomesticTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'domesticTurn' },
  }) as unknown as Ctx;

const callBuy = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  cardName: string,
  x: number,
  y: number,
): typeof INVALID_MOVE | void => {
  const mv = domesticBuyBuilding as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardName: string,
    x: number,
    y: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, cardName, x, y);
};

describe('domesticBuyBuilding (06.2)', () => {
  it('happy path: removes from hand, places on grid, deducts wallet, credits bank', () => {
    const granary = BUILDINGS.find((b) => b.name === 'Granary')!;
    expect(granary.cost).toBe(8);

    const G = build2pState(
      { gold: 15 },
      {
        hand: [granary],
        grid: {},
      },
    );

    const result = callBuy(G, '1', ctxDomesticTurn('1'), 'Granary', 0, 0);

    expect(result).toBeUndefined();
    // Wallet drained by the cost; bank credited symmetrically.
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 7 }));
    expect(G.bank).toEqual(bagOf({ gold: 8 }));
    // Card removed from hand.
    expect(G.domestic!.hand).toHaveLength(0);
    // Building placed on grid; defense redesign D15 — placement seeds
    // hp = maxHp from BuildingDef.maxHp (Granary: 1).
    const placed: DomesticBuilding = {
      defID: 'Granary',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 1,
    };
    expect(G.domestic!.grid[cellKey(0, 0)]).toEqual(placed);
  });

  it('returns INVALID_MOVE on illegal placement (non-adjacent to existing)', () => {
    const granary = BUILDINGS.find((b) => b.name === 'Granary')!;
    const market = BUILDINGS.find((b) => b.name === 'Market')!;

    const existing: DomesticBuilding = {
      defID: 'Market',
      upgrades: 0,
      worker: null,
      hp: 3,
      maxHp: 3,
    };
    const G = build2pState(
      { gold: 50 },
      {
        hand: [granary, market],
        grid: { [cellKey(0, 0)]: existing },
      },
    );

    // (5,5) is far from (0,0) — not orthogonally adjacent.
    const result = callBuy(G, '1', ctxDomesticTurn('1'), 'Granary', 5, 5);

    expect(result).toBe(INVALID_MOVE);
    // No state changed — wallet, bank, hand, grid all intact.
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.hand).toHaveLength(2);
    expect(Object.keys(G.domestic!.grid)).toEqual([cellKey(0, 0)]);
  });

  it('returns INVALID_MOVE when wallet cannot afford the cost', () => {
    const factory = BUILDINGS.find((b) => b.name === 'Factory')!;
    expect(factory.cost).toBe(60);

    const G = build2pState(
      { gold: 5 }, // far short of 60
      {
        hand: [factory],
        grid: {},
      },
    );

    const result = callBuy(G, '1', ctxDomesticTurn('1'), 'Factory', 0, 0);

    expect(result).toBe(INVALID_MOVE);
    // Nothing changed.
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 5 }));
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.hand).toHaveLength(1);
    expect(G.domestic!.grid).toEqual({});
  });
});
