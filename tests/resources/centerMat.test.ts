// Tests for the center mat (03.3): per-seat resource circles, the single
// trade-request slot, and the round-end sweep hook.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import {
  clearTradeRequest,
  initialMat,
  placeIntoCircle,
  pullFromCircle,
  setTradeRequest,
  type TradeRequest,
} from '../../src/game/resources/centerMat.ts';
import { assignRoles, seatOfRole } from '../../src/game/roles.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { initialBank, totalResources } from '../../src/game/resources/bank.ts';
import {
  runRoundEndHooks,
  type RandomAPI,
} from '../../src/game/hooks.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { makeClient } from '../helpers/makeClient.ts';
import { runMoves } from '../helpers/runMoves.ts';

describe('initialMat', () => {
  it('produces one circle per non-chief seat for a 4-player game', () => {
    const mat = initialMat(assignRoles(4));
    expect(Object.keys(mat.circles).sort()).toEqual(['1', '2', '3']);
    // Every circle is an empty bag.
    for (const seat of ['1', '2', '3']) {
      expect(mat.circles[seat]).toEqual(bagOf({}));
    }
    expect(mat.tradeRequest).toBeNull();
  });

  it('produces zero circles for a 1-player game (all roles on seat 0)', () => {
    const mat = initialMat(assignRoles(1));
    expect(Object.keys(mat.circles)).toEqual([]);
    expect(mat.tradeRequest).toBeNull();
    // The plan describes 1-player as "no mat motion needed" — the helpers
    // throw on missing seats by design (clean invariant); a 1-player flow
    // simply never calls them. We assert the structural promise here and
    // skip the helper-call assertion intentionally.
  });

  it('hands distinct circle objects per seat (not aliased to EMPTY_BAG)', () => {
    const mat = initialMat(assignRoles(4));
    placeIntoCircle(mat, '1', { gold: 1 });
    // Seats 2 and 3 must remain at zero — proves the circles are independent
    // bags and not all references to the same shared object.
    expect(mat.circles['2']!.gold).toBe(0);
    expect(mat.circles['3']!.gold).toBe(0);
    expect(mat.circles['1']!.gold).toBe(1);
  });
});

describe('placeIntoCircle / pullFromCircle', () => {
  it('places amounts into the named seat circle', () => {
    const mat = initialMat(assignRoles(4));
    placeIntoCircle(mat, '1', { gold: 2, wood: 1 });
    expect(mat.circles['1']!.gold).toBe(2);
    expect(mat.circles['1']!.wood).toBe(1);
  });

  it('throws when placing into a seat with no circle (chief seat)', () => {
    const mat = initialMat(assignRoles(4));
    // seat '0' is the chief in a 4-player game and has no circle.
    expect(() => placeIntoCircle(mat, '0', { gold: 1 })).toThrow(
      /no circle/,
    );
  });

  it('pulls amounts and decrements the named seat circle', () => {
    const mat = initialMat(assignRoles(4));
    placeIntoCircle(mat, '1', { gold: 3 });
    pullFromCircle(mat, '1', { gold: 2 });
    expect(mat.circles['1']!.gold).toBe(1);
  });

  it('throws when pulling from a seat with no circle', () => {
    const mat = initialMat(assignRoles(4));
    expect(() => pullFromCircle(mat, '0', { gold: 1 })).toThrow(/no circle/);
  });

  it('throws RangeError naming the resource on underflow', () => {
    const mat = initialMat(assignRoles(4));
    placeIntoCircle(mat, '1', { gold: 1 });
    expect(() => pullFromCircle(mat, '1', { gold: 2 })).toThrow(RangeError);
    expect(() => pullFromCircle(mat, '1', { gold: 2 })).toThrow(/gold/);
  });
});

describe('setTradeRequest / clearTradeRequest', () => {
  const sampleReq = (): TradeRequest => ({
    id: 'req-1',
    ownerSeat: '3',
    required: bagOf({ wood: 2 }),
    reward: bagOf({ gold: 1 }),
  });

  it('places a trade request into an empty slot', () => {
    const mat = initialMat(assignRoles(4));
    const req = sampleReq();
    setTradeRequest(mat, req);
    expect(mat.tradeRequest).toBe(req);
  });

  it('rejects placing onto a non-empty slot', () => {
    const mat = initialMat(assignRoles(4));
    setTradeRequest(mat, sampleReq());
    expect(() =>
      setTradeRequest(mat, { ...sampleReq(), id: 'req-2' }),
    ).toThrow(/already present/);
  });

  it('clears the slot back to null', () => {
    const mat = initialMat(assignRoles(4));
    setTradeRequest(mat, sampleReq());
    clearTradeRequest(mat);
    expect(mat.tradeRequest).toBeNull();
    // After clearing, a fresh request can be placed.
    expect(() => setTradeRequest(mat, sampleReq())).not.toThrow();
  });

  it('clearing an already-empty slot is a no-op', () => {
    const mat = initialMat(assignRoles(4));
    expect(() => clearTradeRequest(mat)).not.toThrow();
    expect(mat.tradeRequest).toBeNull();
  });
});

describe('round-end sweep hook (mat:sweep-leftovers)', () => {
  // The sweep hook is registered as a side effect of importing centerMat.ts
  // (which transitively happens via setup.ts → index.ts). We drive it via
  // `runRoundEndHooks` directly so we can preload non-zero circle contents
  // without needing a dedicated move to place them.

  const makeStubCtx = (): Ctx =>
    ({
      numPlayers: 4,
      playOrder: ['0', '1', '2', '3'],
      playOrderPos: 0,
      currentPlayer: '0',
      turn: 0,
      phase: 'endOfRound',
      activePlayers: null,
    }) as unknown as Ctx;

  const makeStubRandom = (): RandomAPI => ({
    Shuffle: <T>(arr: T[]): T[] => [...arr],
    Number: () => 0,
    D6: () => 1,
  });

  const buildG = (): SettlementState => {
    const roleAssignments = assignRoles(4);
    const hands: Record<string, unknown> = {};
    for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
    const wallets: Record<string, ReturnType<typeof bagOf>> = {};
    for (const [seat, roles] of Object.entries(roleAssignments)) {
      if (!roles.includes('chief')) wallets[seat] = bagOf({});
    }
    return {
      bank: initialBank(),
      centerMat: initialMat(roleAssignments),
      roleAssignments,
      round: 0,
      settlementsJoined: 0,
      hands,
      wallets,
      phaseDone: false,
      othersDone: {},
      _stageStack: {},
    };
  };

  it('sweeps every circle into the bank and conserves total resources', () => {
    const G = buildG();
    placeIntoCircle(G.centerMat, '1', { gold: 2, wood: 1 });
    placeIntoCircle(G.centerMat, '2', { stone: 3 });
    placeIntoCircle(G.centerMat, '3', { food: 1, science: 1 });

    const totalBefore = totalResources(G);
    runRoundEndHooks(G, makeStubCtx(), makeStubRandom());

    // Every circle is empty after the sweep.
    expect(G.centerMat.circles['1']).toEqual(bagOf({}));
    expect(G.centerMat.circles['2']).toEqual(bagOf({}));
    expect(G.centerMat.circles['3']).toEqual(bagOf({}));

    // Bank gained exactly what was swept (default starter is 3 gold).
    expect(G.bank.gold).toBe(3 + 2);
    expect(G.bank.wood).toBe(1);
    expect(G.bank.stone).toBe(3);
    expect(G.bank.food).toBe(1);
    expect(G.bank.science).toBe(1);

    // Total resources conserved across the sweep.
    expect(totalResources(G)).toBe(totalBefore);
  });

  it('preserves the trade-request slot across the sweep', () => {
    const G = buildG();
    const req: TradeRequest = {
      id: 'persist',
      ownerSeat: '3',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 1 }),
    };
    setTradeRequest(G.centerMat, req);
    placeIntoCircle(G.centerMat, '1', { gold: 1 });

    runRoundEndHooks(G, makeStubCtx(), makeStubRandom());

    expect(G.centerMat.circles['1']).toEqual(bagOf({}));
    // Trade request is left alone — persists across rounds until the
    // Foreign/Chief flows clear it.
    expect(G.centerMat.tradeRequest).toBe(req);
  });

  it('full client round-cycle leaves circles empty and bank unchanged when no tokens are placed', () => {
    // Belt-and-suspenders: drive an actual round through the engine to
    // confirm the hook fires (and is a no-op) when bgio runs `endOfRound`.
    const client = makeClient({ numPlayers: 4 });
    const before = client.getState()!.G;
    const bankBefore = { ...before.bank };
    const chiefSeat = seatOfRole(before.roleAssignments, 'chief');
    const others = Object.keys(before.roleAssignments).filter(
      (s) => s !== chiefSeat,
    );

    runMoves(client, [{ player: chiefSeat, move: '__testSetPhaseDone' }]);
    for (const seat of others) {
      runMoves(client, [
        { player: seat, move: '__testSetOthersDone', args: [seat] },
      ]);
    }

    const after = client.getState()!;
    expect(after.ctx.phase).toBe('chiefPhase');
    expect(after.G.round).toBe(before.round + 1);
    expect(after.G.bank).toEqual(bankBefore);
    for (const seat of others) {
      expect(after.G.centerMat.circles[seat]).toEqual(bagOf({}));
    }
  });
});

