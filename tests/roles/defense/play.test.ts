// Tests for defensePlay (defense redesign 2.5).
//
// Exercises the three red-tech effect kinds (`unitUpgrade`, `peekTrack`,
// `swapTrackInPhase`, `demoteTrack`) plus rejection cases. The move
// reads `G.defense.techHand` for the named tech, applies its
// `onPlayEffects` against the targeted state, and consumes the card
// (single-use).

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { defensePlay } from '../../../src/game/roles/defense/play.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { UNITS } from '../../../src/data/index.ts';
import type {
  DefenseState,
  DomesticState,
  SettlementState,
} from '../../../src/game/types.ts';
import type {
  TechnologyDef,
  TrackCardDef,
} from '../../../src/data/schema.ts';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';
import type { DefensePlayArgs } from '../../../src/game/roles/defense/redTechEffects.ts';

const ctxDefenseTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'defenseTurn' },
  }) as unknown as Ctx;

const callPlay = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  techDefID: string,
  args?: DefensePlayArgs,
): typeof INVALID_MOVE | void => {
  const mv = defensePlay as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    techDefID: string,
    a?: DefensePlayArgs,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, techDefID, args);
};

const baseState = (
  defense: DefenseState,
  domestic: DomesticState,
  track?: SettlementState['track'],
): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  const state: SettlementState = {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    defense,
    domestic,
  };
  if (track !== undefined) state.track = track;
  return state;
};

const synthThreat = (
  id: string,
  phase: number,
  strength = 2,
): TrackCardDef => ({
  kind: 'threat',
  id,
  name: id,
  phase,
  description: '',
  direction: 'N',
  offset: 0,
  strength,
});

// Build a tech def carrying the named effect on `onPlayEffects`. The
// loader keeps the array as `unknown[]`, so we don't need to fight the
// schema — we just shape the object and cast through.
const techWithEffect = (name: string, effect: unknown): TechnologyDef => ({
  branch: 'Fighting',
  name,
  order: 'free',
  cost: 'free',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
  onPlayEffects: [effect] as unknown[],
});

const scoutDef = UNITS.find((u) => u.name === 'Scout')!;

describe('defensePlay (defense redesign 2.5)', () => {
  it('unitUpgrade: appends a taught skill to the targeted unit, consumes the tech', () => {
    const tech = techWithEffect('Sharpen Edge', { kind: 'unitUpgrade' });
    const G = baseState(
      {
        hand: [],
        techHand: [tech],
        inPlay: [
          {
            id: 'u-1',
            defID: 'Scout',
            cellKey: cellKey(1, 0),
            hp: scoutDef.hp,
            placementOrder: 0,
          },
        ],
      },
      {
        hand: [],
        grid: { [CENTER_CELL_KEY]: { defID: 'Center', upgrades: 0, worker: null, hp: 99, maxHp: 99, isCenter: true } },
      },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Sharpen Edge', {
      kind: 'unitUpgrade',
      unitInstanceID: 'u-1',
      skill: 'sharpen',
    });

    expect(result).toBeUndefined();
    expect(G.defense!.inPlay[0]?.taughtSkills).toEqual(['sharpen']);
    // Card consumed.
    expect(G.defense!.techHand).toHaveLength(0);
  });

  it('unitUpgrade: rejects when the target unit instance does not exist', () => {
    const tech = techWithEffect('Sharpen Edge', { kind: 'unitUpgrade' });
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Sharpen Edge', {
      kind: 'unitUpgrade',
      unitInstanceID: 'u-missing',
      skill: 'sharpen',
    });

    expect(result).toBe(INVALID_MOVE);
    // Card NOT consumed.
    expect(G.defense!.techHand).toHaveLength(1);
  });

  it('peekTrack: marks the next N upcoming card ids as peeked', () => {
    const tech = techWithEffect('Scouting Drone', {
      kind: 'peekTrack',
      amount: 2,
    });
    const upcoming = [
      synthThreat('a', 1),
      synthThreat('b', 1),
      synthThreat('c', 1),
    ];
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
      { upcoming, history: [], currentPhase: 1 },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Scouting Drone');

    expect(result).toBeUndefined();
    expect(G.defense!._peeked).toEqual(['a', 'b']);
    expect(G.defense!.techHand).toHaveLength(0);
  });

  it('swapTrackInPhase: swaps two cards in the same phase pile', () => {
    const tech = techWithEffect('Reshuffle', { kind: 'swapTrackInPhase' });
    const upcoming = [
      synthThreat('a', 1),
      synthThreat('b', 1),
      synthThreat('c', 2),
    ];
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
      { upcoming, history: [], currentPhase: 1 },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Reshuffle', {
      kind: 'swap',
      indexA: 0,
      indexB: 1,
    });

    expect(result).toBeUndefined();
    expect(G.track!.upcoming.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('swapTrackInPhase: rejects when the two indices are in different phases', () => {
    const tech = techWithEffect('Reshuffle', { kind: 'swapTrackInPhase' });
    const upcoming = [
      synthThreat('a', 1),
      synthThreat('b', 2),
    ];
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
      { upcoming, history: [], currentPhase: 1 },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Reshuffle', {
      kind: 'swap',
      indexA: 0,
      indexB: 1,
    });

    expect(result).toBe(INVALID_MOVE);
    expect(G.track!.upcoming.map((c) => c.id)).toEqual(['a', 'b']);
    expect(G.defense!.techHand).toHaveLength(1);
  });

  it('demoteTrack: replaces the next upcoming card with the most recent flipped card', () => {
    const tech = techWithEffect('Sound Retreat', { kind: 'demoteTrack' });
    const upcoming = [synthThreat('next', 3, 5)];
    const history = [
      synthThreat('older', 1, 1),
      synthThreat('recent', 2, 2),
    ];
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
      { upcoming, history, currentPhase: 3 },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Sound Retreat');

    expect(result).toBeUndefined();
    // The recent card slid to upcoming; the original next card moved to history.
    expect(G.track!.upcoming.map((c) => c.id)).toEqual(['recent']);
    expect(G.track!.history.map((c) => c.id)).toEqual(['older', 'next']);
  });

  it('rejects when the named tech is absent from techHand', () => {
    const tech = techWithEffect('Sharpen Edge', { kind: 'unitUpgrade' });
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
    );

    const result = callPlay(
      G,
      '3',
      ctxDefenseTurn('3'),
      'Not A Real Tech',
    );

    expect(result).toBe(INVALID_MOVE);
    expect(G.defense!.techHand).toHaveLength(1);
  });

  it('rejects when onPlayEffects is empty (nothing to do)', () => {
    const tech: TechnologyDef = {
      branch: 'Fighting',
      name: 'Empty',
      order: 'free',
      cost: 'free',
      buildings: '',
      units: '',
      blueEvent: '',
      greenEvent: '',
      redEvent: '',
      goldEvent: '',
      onPlayEffects: [],
    };
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
    );

    const result = callPlay(G, '3', ctxDefenseTurn('3'), 'Empty');
    expect(result).toBe(INVALID_MOVE);
  });

  it('rejects out-of-stage and wrong-role calls', () => {
    const tech = techWithEffect('Scouting Drone', {
      kind: 'peekTrack',
      amount: 1,
    });
    const G = baseState(
      { hand: [], techHand: [tech], inPlay: [] },
      { hand: [], grid: {} },
      { upcoming: [synthThreat('a', 1)], history: [], currentPhase: 1 },
    );

    // Wrong role: seat '2' is domestic in 4p.
    const wrongRole = callPlay(G, '2', ctxDefenseTurn('2'), 'Scouting Drone');
    expect(wrongRole).toBe(INVALID_MOVE);

    // Wrong stage.
    const wrongStage = callPlay(
      G,
      '3',
      { phase: 'othersPhase', activePlayers: { '3': 'domesticTurn' } } as unknown as Ctx,
      'Scouting Drone',
    );
    expect(wrongStage).toBe(INVALID_MOVE);

    // Tech not consumed in either case.
    expect(G.defense!.techHand).toHaveLength(1);
  });
});
