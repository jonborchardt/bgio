// Defense redesign 2.6 (D27) — `scienceDrill` move tests.
//
// We exercise the move directly against a hand-built (G, ctx) fixture so
// each rejection path is locally observable. Stage gating, role gating,
// the once-per-round latch, and unit lookup all live inside the move
// body and can be hit without spinning a full bgio Client. A single
// integration test through the real engine confirms the latch resets
// across rounds (the `science:reset-defense-moves` hook fires from
// `endOfRound.onBegin`).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceDrill } from '../../../../src/game/roles/science/drill.ts';
import { assignRoles, seatOfRole } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import type { ScienceState } from '../../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type { ResourceBag } from '../../../../src/game/resources/types.ts';
import { runRoundEndHooks } from '../../../../src/game/hooks.ts';

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const minimalScience = (): ScienceState => ({
  grid: [],
  underCards: {},
  paid: {},
  completed: [],
  perRoundCompletions: 0,
  hand: [],
});

interface BuildOpts {
  stash?: Partial<ResourceBag>;
  drillUsed?: boolean;
  unitID?: string;
}

const build4pState = (opts: BuildOpts = {}): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  // Synthesize a stash for the science seat (seat '1' in 4p) so the
  // move has something to draw from.
  if (opts.stash !== undefined) {
    mats['1'] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf(opts.stash),
    };
  }

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const science = minimalScience();
  if (opts.drillUsed === true) science.scienceDrillUsed = true;

  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science,
    defense: {
      hand: [],
      inPlay:
        opts.unitID !== undefined
          ? [
              {
                id: opts.unitID,
                defID: 'Brute',
                cellKey: '0,1',
                hp: 2,
                placementOrder: 0,
              },
            ]
          : [],
    },
  };
};

const callDrill = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  unitID: string,
): typeof INVALID_MOVE | void => {
  const mv = scienceDrill as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    unitID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, unitID);
};

describe('scienceDrill (defense redesign 2.6)', () => {
  it('happy path: marks the unit, pays 1 science, latches the per-round flag', () => {
    const G = build4pState({ stash: { science: 3 }, unitID: 'u1' });
    const result = callDrill(G, '1', ctxScienceTurn('1'), 'u1');
    expect(result).toBeUndefined();
    expect(G.defense!.inPlay[0]!.drillToken).toBe(true);
    expect(G.mats['1']!.stash.science).toBe(2);
    expect(G.science!.scienceDrillUsed).toBe(true);
  });

  it('rejects when the per-round latch is already set', () => {
    const G = build4pState({
      stash: { science: 3 },
      drillUsed: true,
      unitID: 'u1',
    });
    const before = JSON.parse(JSON.stringify(G));
    const result = callDrill(G, '1', ctxScienceTurn('1'), 'u1');
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when stash cannot afford the cost', () => {
    const G = build4pState({ stash: { science: 0 }, unitID: 'u1' });
    const result = callDrill(G, '1', ctxScienceTurn('1'), 'u1');
    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.inPlay[0]!.drillToken).not.toBe(true);
    expect(G.science!.scienceDrillUsed).not.toBe(true);
  });

  it('rejects when the unit ID does not resolve in inPlay', () => {
    const G = build4pState({ stash: { science: 3 }, unitID: 'u1' });
    const result = callDrill(G, '1', ctxScienceTurn('1'), 'no-such-unit');
    expect(result).toBe(INVALID_MOVE);
    expect(G.science!.scienceDrillUsed).not.toBe(true);
  });

  it('rejects when caller is not in scienceTurn stage', () => {
    const G = build4pState({ stash: { science: 3 }, unitID: 'u1' });
    const result = callDrill(
      G,
      '1',
      { phase: 'othersPhase', activePlayers: { '1': 'domesticTurn' } } as unknown as Ctx,
      'u1',
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when caller does not hold the science role', () => {
    const G = build4pState({ unitID: 'u1' });
    // Seat '2' is domestic in 4p — synthesize a stash so the only
    // failing gate is the role check.
    G.mats['2'] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf({ science: 3 }),
    };
    const result = callDrill(
      G,
      '2',
      { phase: 'othersPhase', activePlayers: { '2': 'scienceTurn' } } as unknown as Ctx,
      'u1',
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when playerID is undefined (spectator)', () => {
    const G = build4pState({ stash: { science: 3 }, unitID: 'u1' });
    const result = callDrill(G, undefined, ctxScienceTurn('1'), 'u1');
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects empty / non-string unitID', () => {
    const G = build4pState({ stash: { science: 3 }, unitID: 'u1' });
    const result = callDrill(G, '1', ctxScienceTurn('1'), '');
    expect(result).toBe(INVALID_MOVE);
  });

  it('round-end hook resets scienceDrillUsed (and scienceTaughtUsed)', () => {
    // Hook is registered at module load time of drill.ts; importing
    // the move above ensures it's installed. Drive the hook directly
    // so we don't need a full bgio Client round trip.
    const G = build4pState({
      stash: { science: 3 },
      drillUsed: true,
      unitID: 'u1',
    });
    G.science!.scienceTaughtUsed = true;

    const dummyRandom = {
      Shuffle: <T>(arr: T[]): T[] => [...arr],
      Number: () => 0,
      D6: () => 1,
    };
    runRoundEndHooks(G, {} as unknown as Ctx, dummyRandom);

    expect(G.science!.scienceDrillUsed).toBe(false);
    expect(G.science!.scienceTaughtUsed).toBe(false);
  });

  it('determinism stub: seatOfRole resolves science to seat 1 in 4p', () => {
    // Belt-and-braces: the helper layout this suite assumes (science at
    // seat '1' in a 4p game) matches the canonical role-assignment
    // table. If a future redesign moves the seat, every test in this
    // file falls over — pin the assumption here so the failure mode is
    // a single clear assertion rather than 7 ambiguous INVALID_MOVE
    // results.
    const assignments = assignRoles(4);
    expect(seatOfRole(assignments, 'science')).toBe('1');
  });
});
