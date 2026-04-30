// Tests for the slim `centerMat.ts` (trade-request slot only) plus the
// new per-seat `playerMat` helpers.
//
// The older "circles" + round-end "mat:sweep-leftovers" hook were removed
// when the player-mat redesign collapsed the wallet/circle split. Tokens
// no longer linger across rounds in a public buffer; production goes
// straight to the seat's `out`, which the chief sweeps to the bank on
// their next turn (covered in tests/phases/*).

import { describe, expect, it } from 'vitest';
import {
  clearTradeRequest,
  initialCenterMat,
  setTradeRequest,
  type TradeRequest,
} from '../../src/game/resources/centerMat.ts';
import {
  drainBag,
  initialMats,
  placeIntoIn,
  placeIntoOut,
  takeIntoStash,
} from '../../src/game/resources/playerMat.ts';
import { assignRoles } from '../../src/game/roles.ts';
import { bagOf } from '../../src/game/resources/bag.ts';

describe('initialCenterMat', () => {
  it('returns an empty trade-request slot', () => {
    const mat = initialCenterMat();
    expect(mat.tradeRequest).toBeNull();
  });
});

describe('initialMats', () => {
  it('produces one mat per non-chief seat for a 4-player game', () => {
    const mats = initialMats(assignRoles(4));
    expect(Object.keys(mats).sort()).toEqual(['1', '2', '3']);
    for (const seat of ['1', '2', '3']) {
      expect(mats[seat]!.in).toEqual(bagOf({}));
      expect(mats[seat]!.out).toEqual(bagOf({}));
      expect(mats[seat]!.stash).toEqual(bagOf({}));
    }
  });

  it('produces zero mats for a 1-player game (all roles on seat 0)', () => {
    const mats = initialMats(assignRoles(1));
    expect(Object.keys(mats)).toEqual([]);
  });

  it('hands distinct mat objects per seat (not aliased)', () => {
    const mats = initialMats(assignRoles(4));
    placeIntoIn(mats['1']!, { gold: 1 });
    expect(mats['2']!.in.gold).toBe(0);
    expect(mats['3']!.in.gold).toBe(0);
    expect(mats['1']!.in.gold).toBe(1);
  });
});

describe('placeIntoIn / placeIntoOut / takeIntoStash / drainBag', () => {
  it('placeIntoIn deposits and takeIntoStash moves it to stash', () => {
    const mats = initialMats(assignRoles(4));
    placeIntoIn(mats['1']!, { gold: 2, wood: 1 });
    expect(mats['1']!.in).toEqual(bagOf({ gold: 2, wood: 1 }));

    const moved = takeIntoStash(mats['1']!);
    expect(moved).toEqual({ gold: 2, wood: 1 });
    expect(mats['1']!.in).toEqual(bagOf({}));
    expect(mats['1']!.stash).toEqual(bagOf({ gold: 2, wood: 1 }));
  });

  it('placeIntoOut deposits into the out lane only', () => {
    const mats = initialMats(assignRoles(4));
    placeIntoOut(mats['2']!, { stone: 3 });
    expect(mats['2']!.out).toEqual(bagOf({ stone: 3 }));
    expect(mats['2']!.in).toEqual(bagOf({}));
    expect(mats['2']!.stash).toEqual(bagOf({}));
  });

  it('drainBag empties the source and returns the moved partial', () => {
    const mats = initialMats(assignRoles(4));
    placeIntoOut(mats['3']!, { food: 1, science: 1 });
    const moved = drainBag(mats['3']!.out);
    expect(moved).toEqual({ food: 1, science: 1 });
    expect(mats['3']!.out).toEqual(bagOf({}));
  });

  it('placeIntoIn rejects negative amounts', () => {
    const mats = initialMats(assignRoles(4));
    expect(() => placeIntoIn(mats['1']!, { gold: -1 })).toThrow(RangeError);
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
    const mat = initialCenterMat();
    const req = sampleReq();
    setTradeRequest(mat, req);
    expect(mat.tradeRequest).toBe(req);
  });

  it('rejects placing onto a non-empty slot', () => {
    const mat = initialCenterMat();
    setTradeRequest(mat, sampleReq());
    expect(() =>
      setTradeRequest(mat, { ...sampleReq(), id: 'req-2' }),
    ).toThrow(/already present/);
  });

  it('clears the slot back to null', () => {
    const mat = initialCenterMat();
    setTradeRequest(mat, sampleReq());
    clearTradeRequest(mat);
    expect(mat.tradeRequest).toBeNull();
    expect(() => setTradeRequest(mat, sampleReq())).not.toThrow();
  });

  it('clearing an already-empty slot is a no-op', () => {
    const mat = initialCenterMat();
    expect(() => clearTradeRequest(mat)).not.toThrow();
    expect(mat.tradeRequest).toBeNull();
  });
});
