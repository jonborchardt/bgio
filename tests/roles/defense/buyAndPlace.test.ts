// Tests for defenseBuyAndPlace (defense redesign 2.5).
//
// Driven by direct calls to the move's function form against a hand-
// built SettlementState + stub Ctx, in the same style as the other
// 06.x / 07.x move tests. Each case seeds the minimum slice of state
// it needs.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { defenseBuyAndPlace } from '../../../src/game/roles/defense/buyAndPlace.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { UNITS } from '../../../src/data/index.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type {
  DefenseState,
  DomesticState,
  SettlementState,
} from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

// 4-player layout: seat '3' = defense.
const build4pState = (
  walletOf: Partial<ResourceBag>,
  defense: DefenseState,
  domestic: DomesticState,
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  if (mats['3'] !== undefined) mats['3']!.stash = bagOf(walletOf);

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
    defense,
    domestic,
  };
};

const ctxDefenseTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'defenseTurn' },
  }) as unknown as Ctx;

const callBuyAndPlace = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  unitDefID: string,
  cellKeyArg: string,
): typeof INVALID_MOVE | void => {
  const mv = defenseBuyAndPlace as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    unitDefID: string,
    cellKey: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, unitDefID, cellKeyArg);
};

const placedBuilding = (defID: string, maxHp = 2): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp: maxHp,
  maxHp,
});

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const scoutDef = UNITS.find((u) => u.name === 'Scout')!;
const archerDef = UNITS.find((u) => u.name === 'Archer')!;

describe('defenseBuyAndPlace (defense redesign 2.5)', () => {
  it('happy path: pays from stash, appends instance to inPlay, leaves card in hand', () => {
    const G = build4pState(
      { gold: 10 },
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(1, 0)]: placedBuilding('Granary'),
        },
      },
    );

    const result = callBuyAndPlace(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Scout',
      cellKey(1, 0),
    );

    expect(result).toBeUndefined();
    // Stash drained by Scout cost (2 gold), bank credited.
    expect(G.mats['3']?.stash).toEqual(bagOf({ gold: 10 - scoutDef.cost }));
    expect(G.bank.gold).toBe(scoutDef.cost);
    // Hand still carries Scout — recruits draw from a pool.
    expect(G.defense!.hand).toHaveLength(1);
    expect(G.defense!.hand[0]?.name).toBe('Scout');
    // One unit instance with the right defID, cellKey, and hp.
    expect(G.defense!.inPlay).toHaveLength(1);
    expect(G.defense!.inPlay[0]).toMatchObject({
      defID: 'Scout',
      cellKey: cellKey(1, 0),
      hp: scoutDef.hp,
      placementOrder: 0,
    });
    // The id is a stable handle.
    expect(G.defense!.inPlay[0]!.id).toMatch(/^u:Scout:/);
  });

  it('rejects placement on the center tile (D11)', () => {
    const G = build4pState(
      { gold: 10 },
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: { [CENTER_CELL_KEY]: center },
      },
    );

    const result = callBuyAndPlace(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Scout',
      CENTER_CELL_KEY,
    );

    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.inPlay).toHaveLength(0);
    expect(G.bank.gold).toBe(0);
  });

  it('rejects when the target cell has no building', () => {
    const G = build4pState(
      { gold: 10 },
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: { [CENTER_CELL_KEY]: center },
      },
    );

    const result = callBuyAndPlace(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Scout',
      cellKey(2, 2), // empty
    );

    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.inPlay).toHaveLength(0);
  });

  it('rejects when stash cannot cover cost', () => {
    const G = build4pState(
      { gold: 1 }, // Scout costs 2
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(1, 0)]: placedBuilding('Granary'),
        },
      },
    );

    const result = callBuyAndPlace(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Scout',
      cellKey(1, 0),
    );

    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.inPlay).toHaveLength(0);
    // Stash unchanged.
    expect(G.mats['3']?.stash.gold).toBe(1);
  });

  it('rejects when the unit name is not in the seat hand', () => {
    const G = build4pState(
      { gold: 10 },
      // Hand has Scout, but the call asks for Archer.
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(1, 0)]: placedBuilding('Granary'),
        },
      },
    );

    const result = callBuyAndPlace(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Archer',
      cellKey(1, 0),
    );

    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.inPlay).toHaveLength(0);
  });

  it('rejects out-of-stage and wrong-role calls', () => {
    const G = build4pState(
      { gold: 10 },
      { hand: [scoutDef], inPlay: [] },
      {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(1, 0)]: placedBuilding('Granary'),
        },
      },
    );

    // Wrong stage.
    const wrongStage = callBuyAndPlace(
      G,
      '3',
      { phase: 'othersPhase', activePlayers: { '3': 'domesticTurn' } } as unknown as Ctx,
      'Scout',
      cellKey(1, 0),
    );
    expect(wrongStage).toBe(INVALID_MOVE);

    // Wrong role: seat '2' holds domestic in 4p, not defense.
    const wrongRole = callBuyAndPlace(
      G,
      '2',
      ctxDefenseTurn('2'),
      'Scout',
      cellKey(1, 0),
    );
    expect(wrongRole).toBe(INVALID_MOVE);
  });

  it('placementOrder is monotonically increasing across multiple recruits (D13)', () => {
    const G = build4pState(
      { gold: 100 },
      { hand: [scoutDef, archerDef], inPlay: [] },
      {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(1, 0)]: placedBuilding('Granary'),
          [cellKey(0, 1)]: placedBuilding('Granary'),
        },
      },
    );

    // Recruit Scout three times across two tiles, then an Archer. Even
    // though units share tiles, placementOrder must monotonically rise.
    const ctx = ctxDefenseTurn('3');
    expect(callBuyAndPlace(G, '3', ctx, 'Scout', cellKey(1, 0))).toBeUndefined();
    expect(callBuyAndPlace(G, '3', ctx, 'Scout', cellKey(1, 0))).toBeUndefined();
    expect(callBuyAndPlace(G, '3', ctx, 'Scout', cellKey(0, 1))).toBeUndefined();
    expect(callBuyAndPlace(G, '3', ctx, 'Archer', cellKey(1, 0))).toBeUndefined();

    expect(G.defense!.inPlay).toHaveLength(4);
    const orders = G.defense!.inPlay.map((u) => u.placementOrder);
    expect(orders).toEqual([0, 1, 2, 3]);
    // Stack on (1,0) is in placement order [0, 1, 3] — first-placed
    // unit lands at the bottom (index 0 in inPlay-by-cellKey scan), so
    // the resolver's "first in, first killed" rule has a deterministic
    // answer.
    const stackAt10 = G.defense!.inPlay.filter(
      (u) => u.cellKey === cellKey(1, 0),
    );
    expect(stackAt10.map((u) => u.placementOrder)).toEqual([0, 1, 3]);
  });
});
