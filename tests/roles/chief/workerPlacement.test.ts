// Tests for chiefPlaceWorker (04.3) — STUB.
//
// Until 06.1 ships the real Domestic grid + chief worker reserve, this
// move short-circuits behind `G._features.workersEnabled`. The tests below
// drive the move directly against a hand-built SettlementState + stub Ctx
// (the same pattern used by tests/roles/chief/distribute.test.ts), which
// keeps the test independent of bgio's stage/phase wiring — a real client
// isn't needed because the move's validations don't depend on stage state.
//
// Grid-cell shape note: 06.1 redefined the cell as `DomesticBuilding`
//   `{ defID: string; upgrades: number; worker: { ownerSeat } | null }`.
// The stub still only reads `cell.worker`, but the test fixtures match
// the real shape so they typecheck against `SettlementState.domestic`.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { chiefPlaceWorker } from '../../../src/game/roles/chief/workerPlacement.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { SettlementState } from '../../../src/game/types.ts';

// Minimal 2-player SettlementState shell for the move's validations. The
// caller injects feature-flag, chief-reserve, and grid slices via the
// `partial` argument so each test case can land in exactly the state shape
// it cares about.
const build2pState = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const matCircles: Record<string, ReturnType<typeof bagOf>> = {};
  const wallets: Record<string, ReturnType<typeof bagOf>> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    if (!roles.includes('chief')) {
      matCircles[seat] = bagOf({});
      wallets[seat] = bagOf({});
    }
  }
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: { circles: matCircles, tradeRequest: null },
    roleAssignments,
    round: 1,
    hands,
    wallets,
    ...partial,
  };
};

const ctxAt = (phase: string): Ctx => ({ phase } as unknown as Ctx);

const callPlace = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  args: { x: number; y: number },
): typeof INVALID_MOVE | void => {
  const mv = chiefPlaceWorker as unknown as (
    a: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    args: { x: number; y: number },
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, args);
};

describe('chiefPlaceWorker (04.3 stub)', () => {
  it('without _features.workersEnabled=true: returns INVALID_MOVE (06 not landed)', () => {
    const G = build2pState();
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlace(G, '0', ctxAt('chiefPhase'), { x: 0, y: 0 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('happy path with stubbed grid + flag: places worker, decrements reserve, marks cell', () => {
    const G = build2pState({
      _features: { workersEnabled: true },
      chief: { workers: 2 },
      domestic: {
        hand: [],
        grid: {
          '0,0': { defID: 'farm', upgrades: 0, worker: null },
        },
      },
    });

    const result = callPlace(G, '0', ctxAt('chiefPhase'), { x: 0, y: 0 });

    expect(result).toBeUndefined();
    expect(G.chief?.workers).toBe(1);
    expect(G.domestic?.grid['0,0']).toEqual({
      defID: 'farm',
      upgrades: 0,
      worker: { ownerSeat: '0' },
    });
  });

  it('placing on an empty (non-existent) cell returns INVALID_MOVE', () => {
    const G = build2pState({
      _features: { workersEnabled: true },
      chief: { workers: 2 },
      domestic: {
        hand: [],
        // Only (0,0) exists — (1,1) does not.
        grid: {
          '0,0': { defID: 'farm', upgrades: 0, worker: null },
        },
      },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlace(G, '0', ctxAt('chiefPhase'), { x: 1, y: 1 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('placing with zero workers in reserve returns INVALID_MOVE', () => {
    const G = build2pState({
      _features: { workersEnabled: true },
      chief: { workers: 0 },
      domestic: {
        hand: [],
        grid: {
          '0,0': { defID: 'farm', upgrades: 0, worker: null },
        },
      },
    });
    const before = JSON.parse(JSON.stringify(G));

    const result = callPlace(G, '0', ctxAt('chiefPhase'), { x: 0, y: 0 });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });
});
