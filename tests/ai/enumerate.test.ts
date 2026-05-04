// 11.2 — `enumerate` candidate-list tests.
//
// We don't assert exhaustive correctness — `enumerate` is a heuristic for
// MCTS branching, and the move bodies still own real legality via
// `INVALID_MOVE`. The tests here just nail down the phase/stage gating:
// the wrong moves should NOT show up out of context, and the fallback
// `pass` is always present.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { enumerate } from '../../src/game/ai/enumerate.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { setup } from '../../src/game/setup.ts';

const setupG = (): SettlementState => {
  const ctx = { numPlayers: 2 } as unknown as Parameters<typeof setup>[0]['ctx'];
  return setup({ ctx });
};

const ctxFor = (
  phase: string,
  activePlayers?: Record<string, string>,
): Ctx =>
  ({
    phase,
    activePlayers,
    turn: 1,
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    numMoves: 0,
  }) as unknown as Ctx;

describe('enumerate (11.2)', () => {
  it('always includes a `pass` fallback', () => {
    const G = setupG();
    const candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    expect(candidates.some((c) => c.move === 'pass')).toBe(true);
  });

  it('in chiefPhase returns chief candidates and not science candidates', () => {
    const G = setupG();
    const candidates = enumerate(G, ctxFor('chiefPhase'), '0');
    const moveNames = new Set(candidates.map((c) => c.move));

    // Chief moves should be present.
    expect(moveNames.has('chiefEndPhase')).toBe(true);
    expect(moveNames.has('chiefDistribute')).toBe(true);

    // Science moves should not be present.
    expect(moveNames.has('scienceContribute')).toBe(false);
    expect(moveNames.has('scienceComplete')).toBe(false);
  });

  it('in scienceTurn stage returns science candidates and not chief candidates', () => {
    const G = setupG();
    // 2-player layout: seat 0 holds chief+science, seat 1 holds
    // domestic+defense. enumerate the science seat in `othersPhase` /
    // `scienceTurn`.
    const ctx = ctxFor('othersPhase', { '0': 'scienceTurn' });
    const candidates = enumerate(G, ctx, '0');
    const moveNames = new Set(candidates.map((c) => c.move));

    // Science seat sees scienceContribute / scienceComplete (one or both,
    // depending on wallet / paid state — at minimum a sciencePlayBlueEvent
    // or scienceComplete should be available, and `pass` is always present).
    expect(moveNames.has('chiefDistribute')).toBe(false);
    expect(moveNames.has('chiefEndPhase')).toBe(false);

    // pass fallback is present.
    expect(moveNames.has('pass')).toBe(true);

    // sciencePlayBlueEvent is gated by hand contents and the per-round flag —
    // a fresh setup gives the science seat 4 blue cards in hand and the
    // played-this-round flag is false, so we expect at least one event
    // candidate.
    expect(moveNames.has('sciencePlayBlueEvent')).toBe(true);
  });

  it('always returns at least one candidate (pass fallback)', () => {
    const G = setupG();

    // A "no phase, no stage" ctx — none of the role branches fire, but the
    // pass fallback should still be there.
    const candidates = enumerate(G, ctxFor('nonsensePhase'), '0');
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[candidates.length - 1]!.move).toBe('pass');
  });
});
