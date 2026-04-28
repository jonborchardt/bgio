// Tests for chiefDistribute (04.1).
//
// Driven by direct calls to the move's function form against a hand-built
// SettlementState + stub Ctx — the same style used by tests/resources/moves
// for `pullFromMat`. The chief move now reads `ctx.phase`, so we set that
// on the Ctx stub explicitly per case.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { chiefDistribute } from '../../../src/game/roles/chief/distribute.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { SettlementState } from '../../../src/game/types.ts';

// Builds a 2-player state where seat '0' is chief+science and seat '1' is
// domestic+foreign with a circle on the mat.
const build2pState = (
  bank: Partial<ResourceBag> = {},
  circles: Record<string, Partial<ResourceBag>> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
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

const ctxAt = (phase: string): Ctx => ({ phase } as unknown as Ctx);

const callDistribute = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  targetSeat: string,
  amounts: Partial<ResourceBag>,
): typeof INVALID_MOVE | void => {
  const mv = chiefDistribute as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    targetSeat: string,
    amounts: Partial<ResourceBag>,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, targetSeat, amounts);
};

describe('chiefDistribute (04.1)', () => {
  it('happy path: chief moves 2 gold to seat 1; bank loses 2 gold, seat 1 circle gains 2 gold', () => {
    const G = build2pState({ gold: 3 });

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '1', { gold: 2 });

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
    expect(G.centerMat.circles['1']).toEqual(bagOf({ gold: 2 }));
  });

  it('wrong phase: chiefDistribute during othersPhase returns INVALID_MOVE', () => {
    const G = build2pState({ gold: 3 });
    const before = JSON.parse(JSON.stringify(G));

    const result = callDistribute(G, '0', ctxAt('othersPhase'), '1', { gold: 2 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('non-chief caller returns INVALID_MOVE', () => {
    const G = build2pState({ gold: 3 });
    const before = JSON.parse(JSON.stringify(G));

    // Seat '1' is domestic+foreign — not the chief.
    const result = callDistribute(G, '1', ctxAt('chiefPhase'), '1', { gold: 2 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('underflow: bank has 1 gold, distribute 2 gold returns INVALID_MOVE and bank still has 1 gold', () => {
    const G = build2pState({ gold: 1 });
    const before = JSON.parse(JSON.stringify(G));

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '1', { gold: 2 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
  });

  it('self-target: chief tries to distribute to own seat returns INVALID_MOVE', () => {
    const G = build2pState({ gold: 3 });
    const before = JSON.parse(JSON.stringify(G));

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '0', { gold: 1 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
