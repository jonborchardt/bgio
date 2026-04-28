// Tests for the resource moves (03.4): `pullFromMat` and the
// `payFromWallet` shared spend helper.
//
// These run as pure-function tests against a hand-built SettlementState +
// stub `Ctx`. We call the move's function form directly rather than driving
// through a headless client because:
//   - the move's primitives (pullFromCircle, transfer) mutate G directly,
//     so there's no Immer wrapping to lose by skipping the client; and
//   - we don't yet have a "place into my circle" move to seed circle
//     contents through the engine, so building the precondition via the
//     `seedAfterChiefDistribution` helper + a `circles` partial is the
//     shortest path to full coverage.
//
// Phase / stage gating (chiefPhase locks out non-chief seats, etc.) is
// covered separately by the phase tests in 02.x; this file only verifies
// the move's own permission and affordability checks.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { pullFromMat, payFromWallet } from '../../src/game/resources/moves.ts';
import { bagOf } from '../../src/game/resources/bag.ts';
import { assignRoles } from '../../src/game/roles.ts';
import type { ResourceBag } from '../../src/game/resources/types.ts';
import type { SettlementState } from '../../src/game/types.ts';

// Builds a 4-player state where every non-chief seat (1, 2, 3) has a fresh
// circle and a fresh wallet. Caller passes per-seat circle preloads via
// `circles`.
const build4pState = (
  circles: Record<string, Partial<ResourceBag>> = {},
  bank: Partial<ResourceBag> = {},
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const matCircles: Record<string, ResourceBag> = {};
  const wallets: Record<string, ResourceBag> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      matCircles[seat] = bagOf(circles[seat] ?? {});
      wallets[seat] = bagOf({});
    }
  }
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf(bank),
    centerMat: { circles: matCircles, tradeRequest: null },
    roleAssignments,
    round: 1,
    hands,
    wallets,
  };
};

// Minimal Ctx stub — `pullFromMat` doesn't read it, but the bgio Move
// signature requires it on the first argument.
const fakeCtx = {} as Ctx;

// Helper to call the move with the bgio shape `({ G, ctx, playerID, ... },
// ...args)`. `Move` is callable directly when its body doesn't lean on the
// additional random/events/log params (ours doesn't).
const callPull = (
  G: SettlementState,
  playerID: string | undefined,
  amounts: Partial<ResourceBag>,
): typeof INVALID_MOVE | void => {
  // bgio's Move type expects an extended args object; the extra fields are
  // unused so we pass a minimal shim. The runtime location of `playerID` is
  // a top-level field on the move args (not on `ctx`), confirmed by the
  // bgio 0.50 client at runtime.
  const mv = pullFromMat as unknown as (
    args: {
      G: SettlementState;
      ctx: Ctx;
      playerID: string | undefined;
    },
    amounts: Partial<ResourceBag>,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx: fakeCtx, playerID }, amounts);
};

describe('pullFromMat (03.4)', () => {
  it('pulling from your own circle deducts from circle and credits wallet', () => {
    // Seat 1 (science) has 2 gold + 1 wood pre-staged on its circle.
    const G = build4pState({ '1': { gold: 2, wood: 1 } });
    const result = callPull(G, '1', { gold: 2, wood: 1 });

    expect(result).toBeUndefined(); // success: no INVALID_MOVE returned
    expect(G.centerMat.circles['1']).toEqual(bagOf({}));
    expect(G.wallets['1']).toEqual(bagOf({ gold: 2, wood: 1 }));
  });

  it("pulling from a seat with no circle (e.g. unknown seat) returns INVALID_MOVE", () => {
    // The plan calls this "pulling from another seat's circle" — `pullFromMat`
    // only ever drains the *caller's* circle, so the analogous failure mode is
    // a caller whose seat has no circle on the mat. We hand-construct a state
    // where seat '9' is a phantom seat (no role assignment, no circle, no
    // wallet) and assert the move bails before mutating anything.
    const G = build4pState({ '1': { gold: 2 } });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPull(G, '9', { gold: 1 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('chief seat calling pullFromMat returns INVALID_MOVE (chief has no circle)', () => {
    // Seat 0 holds the chief role in a 4-player game and has neither a mat
    // circle nor a wallet — the move must reject without touching state.
    const G = build4pState({ '1': { gold: 2 } });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPull(G, '0', { gold: 1 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('pulling more than the circle holds returns INVALID_MOVE and leaves state unchanged', () => {
    // Seat 1 has 1 gold; ask for 5. Both the circle and the wallet must be
    // exactly as they were before the move.
    const G = build4pState({ '1': { gold: 1 } });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPull(G, '1', { gold: 5 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
    expect(G.centerMat.circles['1']).toEqual(bagOf({ gold: 1 }));
    expect(G.wallets['1']).toEqual(bagOf({}));
  });
});

describe('payFromWallet (03.4)', () => {
  // Smoke coverage for the helper that role purchase moves will share. The
  // detailed per-move coverage lives in the role plans (05.x / 06.x / 07.x);
  // here we lock down the wallet-vs-bank arithmetic and the throw-on-underflow
  // contract that callers convert to INVALID_MOVE.

  it('debits the seat wallet and credits the bank', () => {
    const G = build4pState({}, { gold: 0 });
    G.wallets['1'] = bagOf({ gold: 4, wood: 1 });

    payFromWallet(G, '1', { gold: 3 });

    expect(G.wallets['1']).toEqual(bagOf({ gold: 1, wood: 1 }));
    expect(G.bank).toEqual(bagOf({ gold: 3 }));
  });

  it('throws RangeError on underflow (caller converts to INVALID_MOVE)', () => {
    const G = build4pState({}, { gold: 0 });
    G.wallets['1'] = bagOf({ gold: 1 });

    expect(() => payFromWallet(G, '1', { gold: 2 })).toThrow(RangeError);
  });

  it('throws on a seat with no wallet (chief or absent)', () => {
    const G = build4pState();
    expect(() => payFromWallet(G, '0', { gold: 1 })).toThrow(/no wallet/);
    expect(() => payFromWallet(G, '99', { gold: 1 })).toThrow(/no wallet/);
  });
});
