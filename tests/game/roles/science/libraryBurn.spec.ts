// SL 3.2 — `scienceLibraryBurn` move tests.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceLibraryBurn } from '../../../../src/game/roles/science/libraryBurn.ts';
import { assignRoles } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import type { ScienceState } from '../../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type { LibraryCard } from '../../../../src/game/library/types.ts';
import { emptyLibraryState } from '../../../../src/game/library/state.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../../src/data/schema.ts';

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const minimalScience = (): ScienceState => ({
  hand: [],
});

const fakeBuilding = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  name = `${scienceColor}-${tier}`,
): LibraryCard => ({
  kind: 'building',
  tier,
  scienceColor,
  def: {
    name,
    cost: 0,
    benefit: '',
    note: '',
    maxHp: 1,
    tier,
    scienceColor,
  },
});

interface BuildOpts {
  rowCards?: ReadonlyArray<LibraryCard | null>;
  initialStash?: number;
}

const build4pState = (opts: BuildOpts = {}): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  if (opts.initialStash !== undefined) {
    mats['1'] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf({ wood: opts.initialStash }),
    };
  }

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const seats = Object.keys(roleAssignments);
  const lib = emptyLibraryState(seats);
  if (opts.rowCards !== undefined) {
    for (let i = 0; i < lib.row.length; i++) {
      lib.row[i] = opts.rowCards[i] ?? null;
    }
  }

  return {
    bank: bagOf({}),
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: minimalScience(),
    library: lib,
  };
};

const callBurn = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  slot: number,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBurn as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, slot);
};

describe('scienceLibraryBurn (SL 3.2)', () => {
  it('happy path: slot becomes null, lostIdeas grows by 1 with the same card', () => {
    const card = fakeBuilding('green', 1);
    const G = build4pState({
      rowCards: [card, null, null, null, null, null],
    });
    const result = callBurn(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBeUndefined();
    expect(G.library!.row[0]).toBeNull();
    expect(G.library!.lostIdeas).toHaveLength(1);
    expect(G.library!.lostIdeas[0]).toBe(card);
  });

  it('INVALID_MOVE when slot is null', () => {
    const G = build4pState({
      rowCards: [null, null, null, null, null, null],
    });
    const result = callBurn(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBe(INVALID_MOVE);
    expect(G.library!.lostIdeas).toEqual([]);
  });

  it('INVALID_MOVE when seat is not science', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    // Seat '2' is domestic in 4p.
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '2': 'scienceTurn' },
    } as unknown as Ctx;
    expect(callBurn(G, '2', ctx, 0)).toBe(INVALID_MOVE);
    expect(G.library!.lostIdeas).toEqual([]);
  });

  it('INVALID_MOVE when not in scienceTurn stage', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '1': 'domesticTurn' },
    } as unknown as Ctx;
    expect(callBurn(G, '1', ctx, 0)).toBe(INVALID_MOVE);
  });

  it('stash unchanged after burn (no payment)', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
      initialStash: 7,
    });
    callBurn(G, '1', ctxScienceTurn('1'), 0);
    expect(G.mats['1']!.stash.wood).toBe(7);
  });

  it('discount tableau unchanged after burn (no discount accumulation)', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    callBurn(G, '1', ctxScienceTurn('1'), 0);
    expect(G.library!.discountTableaus['1']).toEqual([]);
  });

  it('rejects out-of-range slot indexes', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    expect(callBurn(G, '1', ctxScienceTurn('1'), -1)).toBe(INVALID_MOVE);
    expect(callBurn(G, '1', ctxScienceTurn('1'), 6)).toBe(INVALID_MOVE);
  });

  it('rejects when playerID is undefined', () => {
    const G = build4pState({
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    expect(callBurn(G, undefined, ctxScienceTurn('1'), 0)).toBe(INVALID_MOVE);
  });

  it('rejects when G.library is undefined', () => {
    const G = build4pState();
    delete (G as { library?: unknown }).library;
    expect(callBurn(G, '1', ctxScienceTurn('1'), 0)).toBe(INVALID_MOVE);
  });
});
