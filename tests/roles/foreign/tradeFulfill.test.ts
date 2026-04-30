// Tests for foreignTradeFulfill — any seat with enough in their own
// stash can fulfill the active trade request: pays `required` from
// their stash, gets `reward` into their stash, increments
// `settlementsJoined`, and clears the slot. The `ownerSeat` field on
// the request still records which Foreign seat flipped the card but
// does NOT restrict who can fulfill.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { foreignTradeFulfill } from '../../../src/game/roles/foreign/tradeFulfill.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type {
  SettlementState,
  ForeignState,
} from '../../../src/game/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const emptyForeign = (): ForeignState => ({
  hand: [],
  inPlay: [],
  battleDeck: [],
  tradeDeck: [],
  inFlight: { battle: null, committed: [] },
});

const buildState = (
  bank: Partial<ResourceBag> = {},
  stashBySeat: Record<string, Partial<ResourceBag>> = {},
  tradeRequest: SettlementState['centerMat']['tradeRequest'] = null,
  numPlayers: 1 | 2 | 3 | 4 = 2,
): SettlementState => {
  const roleAssignments = assignRoles(numPlayers);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  const mats = initialMats(roleAssignments);
  for (const [seat, stash] of Object.entries(stashBySeat)) {
    if (mats[seat] === undefined) continue;
    mats[seat]!.stash = bagOf(stash);
  }
  return {
    bank: bagOf(bank),
    centerMat: { tradeRequest },
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats,
    foreign: emptyForeign(),
  };
};

const ctxAt = (
  stage: string,
  playerID: string,
): Ctx => ({ activePlayers: { [playerID]: stage } } as unknown as Ctx);

const callFulfill = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
): typeof INVALID_MOVE | void => {
  const mv = foreignTradeFulfill as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID });
};

describe('foreignTradeFulfill', () => {
  it('happy path: pays required, gains reward, +1 settlementsJoined, clears slot', () => {
    const G = buildState(
      { gold: 0 },
      { '1': { wood: 2 } },
      {
        id: 'tra-1',
        ownerSeat: '1',
        required: bagOf({ wood: 1 }),
        reward: bagOf({ gold: 0 }),
      },
    );
    G.bank = bagOf({ gold: 5 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };

    const result = callFulfill(G, '1', ctxAt('foreignTurn', '1'));

    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
    expect(G.settlementsJoined).toBe(1);
    // Required moved from stash → bank
    expect(G.mats['1']!.stash.wood).toBe(1);
    expect(G.bank.wood).toBe(1);
    // Reward moved from bank → stash
    expect(G.mats['1']!.stash.gold).toBe(3);
    expect(G.bank.gold).toBe(2);
  });

  it('rejects when no active trade request', () => {
    const G = buildState({ gold: 5 }, { '1': { wood: 1 } }, null);
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, '1', ctxAt('foreignTurn', '1'));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('non-owner can fulfill: ownerSeat is informational, not restrictive', () => {
    // Slot was flipped by seat '0' (foreign). Seat '1' (a different seat
    // entirely) can fulfill from their own stash.
    const G = buildState({ gold: 5 }, { '1': { wood: 2 } });
    G.bank = bagOf({ gold: 5 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '0',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };

    const result = callFulfill(G, '1', ctxAt('scienceTurn', '1'));

    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
    expect(G.settlementsJoined).toBe(1);
    expect(G.mats['1']!.stash.wood).toBe(1);
    expect(G.mats['1']!.stash.gold).toBe(3);
  });

  it('rejects when stash cannot afford required', () => {
    const G = buildState({ gold: 5 }, { '1': { wood: 0 } });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, '1', ctxAt('foreignTurn', '1'));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('any stage works: stage gating no longer applies', () => {
    // Calling from `domesticTurn` stage still goes through — the move
    // itself doesn't gate on stage; bgio's `activePlayers` map enforces
    // who-can-call from the engine side.
    const G = buildState({ gold: 5 }, { '1': { wood: 1 } });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const result = callFulfill(G, '1', ctxAt('domesticTurn', '1'));
    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
  });

  it('seat without foreign role can still fulfill from their own stash', () => {
    // 4p: seat '1' is the science seat (has its own mat / stash). The
    // request was flipped by seat '3' (foreign), but seat '1' pays from
    // its own stash and receives the reward into its own stash.
    const G = buildState({ gold: 5 }, { '1': { wood: 1 } }, null, 4);
    G.bank = bagOf({ gold: 5 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '3',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const result = callFulfill(G, '1', ctxAt('scienceTurn', '1'));
    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
    expect(G.mats['1']!.stash.wood).toBe(0);
    expect(G.mats['1']!.stash.gold).toBe(3);
    expect(G.settlementsJoined).toBe(1);
  });

  it('rejects when caller has no mat (e.g., chief seat)', () => {
    // 4p: seat '0' is the chief; the chief acts on `G.bank` directly and
    // owns no player mat. Without a stash to pay from, the move rejects.
    const G = buildState({ gold: 5 }, {}, null, 4);
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '3',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, '0', ctxAt('scienceTurn', '0'));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
