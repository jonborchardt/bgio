// Defense redesign 2.6 (D27) — `scienceTeach` move tests.
//
// Mirrors the structure of `drill.spec.ts`: hand-built (G, ctx) fixture
// drives each rejection path, plus a happy-path that confirms the skill
// lands on the unit and the per-round latch flips. The reinforce side-
// effect (current hp +1) is verified explicitly because it's the one
// branch where the move mutates more than `taughtSkills`.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceTeach } from '../../../../src/game/roles/science/teach.ts';
import { SKILLS } from '../../../../src/game/roles/science/skills.ts';
import { assignRoles } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import type { ScienceState } from '../../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type { ResourceBag } from '../../../../src/game/resources/types.ts';

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
  taughtUsed?: boolean;
  unitID?: string;
  initialTaught?: string[];
  unitHp?: number;
}

const build4pState = (opts: BuildOpts = {}): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
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
  if (opts.taughtUsed === true) science.scienceTaughtUsed = true;

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
                hp: opts.unitHp ?? 2,
                placementOrder: 0,
                taughtSkills:
                  opts.initialTaught !== undefined
                    ? [...opts.initialTaught]
                    : undefined,
              },
            ]
          : [],
    },
  };
};

const callTeach = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  unitID: string,
  skillID: string,
): typeof INVALID_MOVE | void => {
  const mv = scienceTeach as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    unitID: string,
    skillID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, unitID, skillID);
};

describe('scienceTeach (defense redesign 2.6)', () => {
  it('happy path: appends skill, pays the skill cost, latches the flag', () => {
    const cost = SKILLS.extendRange.cost;
    const G = build4pState({ stash: { science: cost + 1 }, unitID: 'u1' });
    const result = callTeach(
      G,
      '1',
      ctxScienceTurn('1'),
      'u1',
      'extendRange',
    );
    expect(result).toBeUndefined();
    expect(G.defense!.inPlay[0]!.taughtSkills).toEqual(['extendRange']);
    expect(G.mats['1']!.stash.science).toBe(1);
    expect(G.science!.scienceTaughtUsed).toBe(true);
  });

  it('reinforce skill bumps the unit current hp by +1', () => {
    const cost = SKILLS.reinforce.cost;
    const G = build4pState({
      stash: { science: cost },
      unitID: 'u1',
      unitHp: 2,
    });
    const result = callTeach(G, '1', ctxScienceTurn('1'), 'u1', 'reinforce');
    expect(result).toBeUndefined();
    expect(G.defense!.inPlay[0]!.hp).toBe(3);
    expect(G.defense!.inPlay[0]!.taughtSkills).toEqual(['reinforce']);
  });

  it('rejects duplicate skill on the same unit', () => {
    const cost = SKILLS.sharpen.cost;
    const G = build4pState({
      stash: { science: cost * 2 },
      unitID: 'u1',
      initialTaught: ['sharpen'],
    });
    const before = JSON.parse(JSON.stringify(G));
    const result = callTeach(G, '1', ctxScienceTurn('1'), 'u1', 'sharpen');
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when the per-round latch is already set', () => {
    const cost = SKILLS.extendRange.cost;
    const G = build4pState({
      stash: { science: cost + 1 },
      taughtUsed: true,
      unitID: 'u1',
    });
    const before = JSON.parse(JSON.stringify(G));
    const result = callTeach(
      G,
      '1',
      ctxScienceTurn('1'),
      'u1',
      'extendRange',
    );
    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('rejects when stash cannot afford the skill cost', () => {
    const G = build4pState({ stash: { science: 0 }, unitID: 'u1' });
    const result = callTeach(
      G,
      '1',
      ctxScienceTurn('1'),
      'u1',
      'extendRange',
    );
    expect(result).toBe(INVALID_MOVE);
    expect(G.science!.scienceTaughtUsed).not.toBe(true);
  });

  it('rejects unknown skillID', () => {
    const G = build4pState({ stash: { science: 5 }, unitID: 'u1' });
    const result = callTeach(
      G,
      '1',
      ctxScienceTurn('1'),
      'u1',
      'no-such-skill',
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects when the unit ID does not resolve', () => {
    const G = build4pState({ stash: { science: 5 }, unitID: 'u1' });
    const result = callTeach(
      G,
      '1',
      ctxScienceTurn('1'),
      'missing',
      'extendRange',
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects from non-science seat', () => {
    const G = build4pState({ unitID: 'u1' });
    G.mats['2'] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf({ science: 5 }),
    };
    const result = callTeach(
      G,
      '2',
      { phase: 'othersPhase', activePlayers: { '2': 'scienceTurn' } } as unknown as Ctx,
      'u1',
      'extendRange',
    );
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects out-of-stage call', () => {
    const G = build4pState({ stash: { science: 5 }, unitID: 'u1' });
    const result = callTeach(
      G,
      '1',
      { phase: 'othersPhase', activePlayers: { '1': 'domesticTurn' } } as unknown as Ctx,
      'u1',
      'extendRange',
    );
    expect(result).toBe(INVALID_MOVE);
  });
});
