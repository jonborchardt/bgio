// Tests for domesticProduce (06.4).
//
// Drives the move directly against a hand-built SettlementState, in the
// same style as the other 06.x / 07.x move tests. The round-end hook test
// uses `runRoundEndHooks` from `src/game/hooks.ts` directly; importing
// `produce.ts` registers `domestic:reset-produced` at module load.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { domesticProduce } from '../../../src/game/roles/domestic/produce.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import {
  runRoundEndHooks,
  type RandomAPI as HookRandomAPI,
} from '../../../src/game/hooks.ts';
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

// Minimal Ctx stub for round-end hook invocations. The hooks under test
// don't read these fields; they exist only to satisfy the type signature.
const stubEndOfRoundCtx = (): Ctx =>
  ({
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const stubHookRandom = (): HookRandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

const callProduce = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
): typeof INVALID_MOVE | void => {
  const mv = domesticProduce as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string | undefined;
  }) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

const granaryCell: DomesticBuilding = {
  defID: 'Granary',
  upgrades: 0,
  worker: null,
};
const millCell: DomesticBuilding = {
  defID: 'Mill',
  upgrades: 0,
  worker: null,
};
const granaryWithWorker: DomesticBuilding = {
  defID: 'Granary',
  upgrades: 0,
  worker: { ownerSeat: '0' },
};

describe('domesticProduce (06.4)', () => {
  it('empty grid yields zero resources to the bank', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        grid: {},
      },
    );

    const result = callProduce(G, '1', ctxDomesticTurn('1'));

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({}));
    expect(G.domestic!.producedThisRound).toBe(true);
  });

  it('a single Granary ("2 food") yields 2 food into the bank', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        grid: { [cellKey(0, 0)]: granaryCell },
      },
    );

    const result = callProduce(G, '1', ctxDomesticTurn('1'));

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ food: 2 }));
    expect(G.domestic!.producedThisRound).toBe(true);
  });

  it('a Mill ("2 food and 1 production") yields both resources', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        grid: { [cellKey(0, 0)]: millCell },
      },
    );

    const result = callProduce(G, '1', ctxDomesticTurn('1'));

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ food: 2, production: 1 }));
  });

  it('producing twice in a round: second call returns INVALID_MOVE', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        grid: { [cellKey(0, 0)]: granaryCell },
      },
    );

    const first = callProduce(G, '1', ctxDomesticTurn('1'));
    expect(first).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ food: 2 }));

    const second = callProduce(G, '1', ctxDomesticTurn('1'));
    expect(second).toBe(INVALID_MOVE);
    // Bank not double-credited.
    expect(G.bank).toEqual(bagOf({ food: 2 }));
  });

  it('after endOfRound the flag resets and produce works again', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        grid: { [cellKey(0, 0)]: granaryCell },
      },
    );

    callProduce(G, '1', ctxDomesticTurn('1'));
    expect(G.domestic!.producedThisRound).toBe(true);

    // The `domestic:reset-produced` hook is registered at module load when
    // `produce.ts` is imported (top of file); running every registered
    // hook clears the latch.
    runRoundEndHooks(G, stubEndOfRoundCtx(), stubHookRandom());
    expect(G.domestic!.producedThisRound).toBe(false);

    // A second produce in the *next* round succeeds and credits the bank
    // again.
    const result = callProduce(G, '1', ctxDomesticTurn('1'));
    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ food: 4 }));
  });

  it('a worker on a building doubles its yield (V1 stub)', () => {
    const G = build2pState(
      {},
      {
        hand: [],
        // One Granary without a worker (2 food), one Granary with a
        // worker (2 + 2 = 4 food). Expected total: 6 food.
        grid: {
          [cellKey(0, 0)]: granaryCell,
          [cellKey(1, 0)]: granaryWithWorker,
        },
      },
    );

    const result = callProduce(G, '1', ctxDomesticTurn('1'));

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ food: 6 }));
  });
});
