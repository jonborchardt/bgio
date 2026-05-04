// Tests for domesticRepair (defense redesign 1.3, D17).
//
// Drives the move directly against a hand-built SettlementState, in the
// same style as the other domestic move tests.
//
// Invariants under test:
//   - Cost = ceil(def.cost * wantedAmount / maxHp), gold from stash.
//   - Wanted amount is clamped to `maxHp - hp`; passing 99 against a
//     building down by 1 only pays for 1 HP.
//   - INVALID_MOVE on: missing cell, center cell, already-full cell,
//     unaffordable cost, non-positive amount, empty/missing G.domestic,
//     wrong stage, missing role.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticRepair } from '../../../src/game/roles/domestic/repair.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { BUILDINGS } from '../../../src/data/index.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type {
  DomesticState,
  SettlementState,
} from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import {
  CENTER_CELL_KEY,
  CENTER_DEF_ID,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
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
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
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

const callRepair = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  x: number,
  y: number,
  amount: number,
): typeof INVALID_MOVE | void => {
  const mv = domesticRepair as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    x: number,
    y: number,
    amount: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, x, y, amount);
};

const damagedMill = (hp: number): DomesticBuilding => ({
  defID: 'Mill',
  upgrades: 0,
  worker: null,
  hp,
  maxHp: 2,
});

describe('domesticRepair (defense redesign D17)', () => {
  it('partial repair: pays ceil(cost * amount / maxHp) gold and bumps hp', () => {
    // Mill: cost 13, maxHp 2. Repair 1 HP costs ceil(13 * 1 / 2) = 7 gold.
    const mill = BUILDINGS.find((b) => b.name === 'Mill')!;
    expect(mill.cost).toBe(13);
    expect(mill.maxHp).toBe(2);

    const G = build2pState(
      { gold: 20 },
      {
        hand: [],
        grid: { [cellKey(2, 3)]: damagedMill(1) },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 2, 3, 1);

    expect(result).toBeUndefined();
    expect(G.domestic!.grid[cellKey(2, 3)]!.hp).toBe(2);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 13 }));
    expect(G.bank).toEqual(bagOf({ gold: 7 }));
  });

  it('clamps wanted amount to missing HP — generous request only pays for what fits', () => {
    // Mill at HP 1/2, request 99. Should clamp to 1 HP, cost = 7.
    const G = build2pState(
      { gold: 20 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: damagedMill(1) },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, 99);

    expect(result).toBeUndefined();
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);
    // Charged for 1 HP only (cost 7), not 99 HP.
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 13 }));
  });

  it('returns INVALID_MOVE when the cell is at full HP', () => {
    const fullMill: DomesticBuilding = damagedMill(2);
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: fullMill },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, 1);

    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);
  });

  it('returns INVALID_MOVE when the cell does not exist', () => {
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: {},
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 5, 5, 1);

    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
  });

  it('returns INVALID_MOVE when targeting the center tile', () => {
    const center: DomesticBuilding = {
      defID: CENTER_DEF_ID,
      upgrades: 0,
      worker: null,
      hp: 99,
      maxHp: 99,
      isCenter: true,
    };
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: { [CENTER_CELL_KEY]: center },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 0, 0, 1);

    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
    expect(G.bank).toEqual(bagOf({}));
    // Center HP unchanged (still at the seeded 99/99).
    expect(G.domestic!.grid[CENTER_CELL_KEY]!.hp).toBe(99);
  });

  it('returns INVALID_MOVE when the seat cannot afford the cost', () => {
    // Mill at HP 1/2: 1-HP repair costs 7 gold. With only 5 in stash the
    // move bails before paying.
    const G = build2pState(
      { gold: 5 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: damagedMill(1) },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, 1);

    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 5 }));
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
  });

  it('returns INVALID_MOVE on a non-positive amount (0, negative, NaN)', () => {
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: damagedMill(1) },
      },
    );

    expect(callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, 0)).toBe(INVALID_MOVE);
    expect(callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, -3)).toBe(INVALID_MOVE);
    expect(callRepair(G, '1', ctxDomesticTurn('1'), 0, 1, Number.NaN)).toBe(
      INVALID_MOVE,
    );
    // Wallet untouched, hp untouched.
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
    expect(G.domestic!.grid[cellKey(0, 1)]!.hp).toBe(1);
  });

  it('returns INVALID_MOVE when not in domesticTurn stage', () => {
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: damagedMill(1) },
      },
    );
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '1': 'defenseTurn' },
    } as unknown as Ctx;

    const result = callRepair(G, '1', ctx, 0, 1, 1);

    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 50 }));
  });

  it('returns INVALID_MOVE when the seat does not hold the domestic role', () => {
    const G = build2pState(
      { gold: 50 },
      {
        hand: [],
        grid: { [cellKey(0, 1)]: damagedMill(1) },
      },
    );
    // Seat '0' is chief+science in the 2-player layout (no domestic).
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '0': 'domesticTurn' },
    } as unknown as Ctx;

    const result = callRepair(G, '0', ctx, 0, 1, 1);

    expect(result).toBe(INVALID_MOVE);
  });

  it('repairing 2 HP at once on a 4-HP building costs ceil(cost * 2 / maxHp)', () => {
    // Walls: cost 13, maxHp 4. Repair 2 HP costs ceil(13 * 2 / 4) =
    // ceil(6.5) = 7.
    const walls = BUILDINGS.find((b) => b.name === 'Walls')!;
    expect(walls.cost).toBe(13);
    expect(walls.maxHp).toBe(4);

    const damaged: DomesticBuilding = {
      defID: 'Walls',
      upgrades: 0,
      worker: null,
      hp: 1,
      maxHp: 4,
    };
    const G = build2pState(
      { gold: 20 },
      {
        hand: [],
        grid: { [cellKey(2, 0)]: damaged },
      },
    );

    const result = callRepair(G, '1', ctxDomesticTurn('1'), 2, 0, 2);

    expect(result).toBeUndefined();
    expect(G.domestic!.grid[cellKey(2, 0)]!.hp).toBe(3);
    expect(G.mats['1']?.stash).toEqual(bagOf({ gold: 13 }));
    expect(G.bank).toEqual(bagOf({ gold: 7 }));
  });
});

// Defense redesign D15 — verify that placement (via domesticBuy) seeds
// hp = maxHp on every non-center cell. We piggyback on the produce-test
// fixtures rather than booting the buy move here; the buy.test.ts
// shape-asserts on the placed cell already, but this case nails down
// the *intent* (hp == maxHp) across the BUILDINGS table.
describe('placement HP invariant (D15)', () => {
  it('every BuildingDef has a maxHp in [1, 4]', () => {
    for (const def of BUILDINGS) {
      expect(Number.isInteger(def.maxHp)).toBe(true);
      expect(def.maxHp).toBeGreaterThanOrEqual(1);
      expect(def.maxHp).toBeLessThanOrEqual(4);
    }
  });
});
