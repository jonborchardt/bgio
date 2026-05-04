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
import { initialMats } from '../../../src/game/resources/playerMat.ts';

// Builds a 2-player state where seat '0' is chief+science and seat '1' is
// domestic+defense. The `inSlots` argument seeds `mats[seat].in` for any
// non-chief seat (used by the pull-back tests).
const build2pState = (
  bank: Partial<ResourceBag> = {},
  inSlots: Record<string, Partial<ResourceBag>> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const mats = initialMats(roleAssignments);
  for (const [seat, slot] of Object.entries(inSlots)) {
    if (mats[seat] === undefined) continue;
    mats[seat]!.in = bagOf(slot);
  }

  return {
    bank: bagOf(bank),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
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
  it('happy path: chief moves 2 gold to seat 1; bank loses 2 gold, seat 1 in-slot gains 2 gold', () => {
    const G = build2pState({ gold: 3 });

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '1', { gold: 2 });

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
    expect(G.mats['1']!.in).toEqual(bagOf({ gold: 2 }));
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

    // Seat '1' is domestic+defense — not the chief.
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

  it('pull-back: negative amount moves tokens from seat in-slot back to bank', () => {
    const G = build2pState({ gold: 1 }, { '1': { gold: 2 } });

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '1', { gold: -2 });

    expect(result).toBeUndefined();
    expect(G.bank).toEqual(bagOf({ gold: 3 }));
    expect(G.mats['1']!.in).toEqual(bagOf({ gold: 0 }));
  });

  it('pull-back underflow: in-slot has 1 gold, pull -2 returns INVALID_MOVE', () => {
    const G = build2pState({ gold: 0 }, { '1': { gold: 1 } });
    const before = JSON.parse(JSON.stringify(G));

    const result = callDistribute(G, '0', ctxAt('chiefPhase'), '1', { gold: -2 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
