// Tests for foreignTradeFulfill — chief-only fulfillment.
//
// The chief seat pays `required` from `G.bank` to "the trader" and
// receives `reward` back into `G.bank`, ticking `settlementsJoined`
// and clearing the slot. Non-chief seats can't fulfill — the move
// rejects with INVALID_MOVE. The `ownerSeat` field on the request
// records which Foreign seat flipped the card (audit only).

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
  tradeRequest: SettlementState['centerMat']['tradeRequest'] = null,
  numPlayers: 1 | 2 | 3 | 4 = 2,
): SettlementState => {
  const roleAssignments = assignRoles(numPlayers);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};
  const mats = initialMats(roleAssignments);
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

// In assignRoles(2) the chief seat is seat '0' (chief+science) and seat '1'
// holds domestic+foreign. In assignRoles(4) the chief seat is seat '0'.
const CHIEF_SEAT_2P = '0';
const NON_CHIEF_SEAT_2P = '1';
const CHIEF_SEAT_4P = '0';

describe('foreignTradeFulfill', () => {
  it('happy path: chief pays required from bank, gains reward in bank, +1 settlementsJoined, clears slot', () => {
    const G = buildState({ wood: 2, gold: 0 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };

    const result = callFulfill(G, CHIEF_SEAT_2P, ctxAt('chiefPhase', CHIEF_SEAT_2P));

    expect(result).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
    expect(G.settlementsJoined).toBe(1);
    // Bank lost required, gained reward.
    expect(G.bank.wood).toBe(1);
    expect(G.bank.gold).toBe(3);
  });

  it('rejects when no active trade request', () => {
    const G = buildState({ wood: 1 }, null);
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, CHIEF_SEAT_2P, ctxAt('chiefPhase', CHIEF_SEAT_2P));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when caller is not the chief seat', () => {
    // Seat '1' holds domestic+foreign in 2p — not chief. Even with the
    // request parked and resources available somewhere, the non-chief
    // seat can't fulfill.
    const G = buildState({ wood: 5, gold: 5 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, NON_CHIEF_SEAT_2P, ctxAt('foreignTurn', NON_CHIEF_SEAT_2P));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when bank cannot afford required', () => {
    const G = buildState({ wood: 0, gold: 5 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const before = JSON.parse(JSON.stringify(G));
    const result = callFulfill(G, CHIEF_SEAT_2P, ctxAt('chiefPhase', CHIEF_SEAT_2P));
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when caller has no playerID', () => {
    const G = buildState({ wood: 1 });
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '1',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };
    const result = callFulfill(G, undefined, ctxAt('chiefPhase', CHIEF_SEAT_2P));
    expect(result).toBe(INVALID_MOVE);
  });

  it('4-player: chief at seat 0 can fulfill; other seats cannot', () => {
    const G = buildState({ wood: 1, gold: 0 }, null, 4);
    G.centerMat.tradeRequest = {
      id: 'tra-1',
      ownerSeat: '3',
      required: bagOf({ wood: 1 }),
      reward: bagOf({ gold: 3 }),
    };

    // Seat '1' (science) — rejected.
    const reject = callFulfill(G, '1', ctxAt('scienceTurn', '1'));
    expect(reject).toBe(INVALID_MOVE);
    expect(G.centerMat.tradeRequest).not.toBeNull();

    // Seat '0' (chief) — succeeds.
    const ok = callFulfill(G, CHIEF_SEAT_4P, ctxAt('chiefPhase', CHIEF_SEAT_4P));
    expect(ok).toBeUndefined();
    expect(G.centerMat.tradeRequest).toBeNull();
    expect(G.settlementsJoined).toBe(1);
    expect(G.bank.wood).toBe(0);
    expect(G.bank.gold).toBe(3);
  });
});
