// Issue 017 — track-card modifier end-to-end coverage.
//
// Each modifier kind gets one round-trip:
//   1. flip the card via `resolveTrackCard` (the same dispatcher
//      `chiefFlipTrack` calls)
//   2. verify the card landed on `G.track.activeModifiers` AND its
//      effect landed on `G._modifiers`
//   3. drive the conditioned move and verify the rule actually bent
//   4. run the round-end hook and verify cleanup wiped both queues.
//
// We exercise the resolver / produce / playEvent paths directly rather
// than booting a full bgio Client so each test pins its specific
// invariant cheaply.

import { describe, expect, it } from 'vitest';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { Move } from 'boardgame.io';
import {
  resolveTrackCard,
  resolveThreat,
} from '../../../src/game/track/resolver.ts';
import { runProduceForSeat } from '../../../src/game/roles/domestic/produce.ts';
import { runRoundEndHooks, type RandomAPI as HookRandomAPI } from '../../../src/game/hooks.ts';
import type { Ctx } from 'boardgame.io';
import {
  hasModifierActive,
} from '../../../src/game/events/dispatcher.ts';
import type {
  ModifierCard,
  ThreatCard,
} from '../../../src/data/schema.ts';
import type {
  RandomAPI,
} from '../../../src/game/random.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import { CENTER_CELL_KEY, cellKey } from '../../../src/game/roles/domestic/grid.ts';
import { seedFreshGame } from '../../helpers/factories.ts';
import { sciencePlayBlueEvent } from '../../../src/game/roles/science/playBlueEvent.ts';

const detRandom = (): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
  pickOne: <T>(arr: ReadonlyArray<T>): T => arr[0]!,
  rangeInt: (lo: number) => lo,
});

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const millAt = (): DomesticBuilding => ({
  defID: 'Mill',
  upgrades: 0,
  worker: null,
  hp: 2,
  maxHp: 2,
} as DomesticBuilding & { name?: never });

const harvest: ModifierCard = {
  id: 'mod-harvest',
  kind: 'modifier',
  name: 'Bountiful Harvest',
  phase: 3,
  durationRounds: 1,
  description: 'Doubles produce this round.',
  effect: { kind: 'doubleProduceThisRound' },
};

const storm: ModifierCard = {
  id: 'mod-storm',
  kind: 'modifier',
  name: 'Storm Warning',
  phase: 4,
  durationRounds: 1,
  description: '+1 strength to next threat.',
  effect: { kind: 'threatStrengthBump', amount: 1 },
};

const quietCouncil: ModifierCard = {
  id: 'mod-quiet',
  kind: 'modifier',
  name: 'Quiet Council',
  phase: 5,
  durationRounds: 1,
  description: 'No events this round.',
  effect: { kind: 'suppressEventsThisRound' },
};

describe('issue 017 — modifier track cards land on both queues', () => {
  it('resolveTrackCard pushes the modifier card AND its effect onto the dispatcher queue', () => {
    const G = seedFreshGame(4);
    expect(G.track?.activeModifiers ?? []).toEqual([]);
    expect(G._modifiers ?? []).toEqual([]);

    resolveTrackCard(G, detRandom(), storm);

    expect(G.track?.activeModifiers).toHaveLength(1);
    expect(G.track!.activeModifiers![0]!.id).toBe('mod-storm');
    expect(hasModifierActive(G, 'threatStrengthBump')).toBe(true);
  });
});

describe('issue 017 — threatStrengthBump is consumed by resolveThreat', () => {
  it('bumps the threat strength by the modifier amount and consumes one modifier', () => {
    // Place a Scout (attack=1, hp=1) at (0,1). Without the bump, a
    // strength-1 threat dies on the first fire and never reaches the
    // Mill below. With the +1 bump, the threat survives the fire
    // (2 strength − 1 atk = 1 hp left) and chips the Mill. The
    // observable: the building's HP drops only when the modifier is
    // active. Fixture-deck Scout / Mill are the right shape.
    const buildG = (): SettlementState => {
      const g = seedFreshGame(4);
      g.domestic = {
        hand: [],
        grid: {
          [CENTER_CELL_KEY]: center,
          [cellKey(0, 1)]: {
            defID: 'Mill',
            upgrades: 0,
            worker: null,
            hp: 2,
            maxHp: 2,
          } as DomesticBuilding,
        },
      };
      g.defense = {
        hand: [],
        inPlay: [
          {
            id: 'u-1',
            defID: 'Scout',
            cellKey: cellKey(0, 1),
            hp: 1,
            placementOrder: 0,
            drillToken: false,
            taughtSkills: [],
          } as UnitInstance,
        ],
      };
      return g;
    };
    const t: ThreatCard = {
      id: 't1',
      kind: 'threat',
      name: 'Test Threat',
      phase: 1,
      description: '',
      direction: 'N',
      offset: 0,
      strength: 1,
    };

    // Without the modifier — Scout's printed attack=1 kills the
    // strength-1 threat outright.
    const G1 = buildG();
    resolveThreat(G1, detRandom(), t);
    expect(G1.domestic!.grid[cellKey(0, 1)]!.hp).toBe(2);

    // With the modifier — threat is bumped to strength=2, survives the
    // 1-damage fire (1 hp leftover), and chips the Mill behind the
    // unit.
    const G2 = buildG();
    resolveTrackCard(G2, detRandom(), storm);
    expect(hasModifierActive(G2, 'threatStrengthBump')).toBe(true);
    resolveThreat(G2, detRandom(), t);
    expect(hasModifierActive(G2, 'threatStrengthBump')).toBe(false);
    expect(G2.domestic!.grid[cellKey(0, 1)]!.hp).toBeLessThan(2);
  });
});

describe('issue 017 — suppressEventsThisRound blocks playEvent moves', () => {
  it('sciencePlayBlueEvent returns INVALID_MOVE while suppress modifier is active', () => {
    const G = seedFreshGame(4);
    resolveTrackCard(G, detRandom(), quietCouncil);
    expect(hasModifierActive(G, 'suppressEventsThisRound')).toBe(true);

    // Simulate a play call with seat 1 (science seat in 4-player layout).
    const mv = sciencePlayBlueEvent as unknown as Move<SettlementState>;
    type MoveFn = (
      a: { G: SettlementState; ctx: unknown; playerID: string; random: unknown; events: unknown },
      cardID: string,
    ) => typeof INVALID_MOVE | void;
    const result = (mv as unknown as MoveFn)(
      {
        G,
        ctx: { numPlayers: 4, currentPlayer: '1' } as unknown,
        playerID: '1',
        random: { Shuffle: <T>(a: T[]) => a, Number: () => 0 },
        events: undefined,
      },
      'any-card-id',
    );
    expect(result).toBe(INVALID_MOVE);
  });
});

describe('issue 017 — doubleProduceThisRound doubles the seat\'s produce bag', () => {
  it('runProduceForSeat doubles output when modifier is active', () => {
    const G = seedFreshGame(4);
    // Build a deterministic 2x2 grid: center + Mill at (0,1). Mill's
    // benefit is "1 food" per the live deck — small enough that the
    // doubling is visible in the seat's `out` bag.
    G.domestic = {
      hand: [],
      grid: {
        [CENTER_CELL_KEY]: center,
        [cellKey(0, 1)]: millAt(),
      },
    };

    // Domestic seat in 4-player is seat '2'.
    runProduceForSeat(G, '2');
    const baseFood = G.mats!['2']!.out.food;

    // Reset latch and active state, push the modifier, run again.
    G.domestic.producedThisRound = false;
    G.mats!['2']!.out.food = 0;
    resolveTrackCard(G, detRandom(), harvest);
    runProduceForSeat(G, '2');
    const doubledFood = G.mats!['2']!.out.food;

    expect(doubledFood).toBe(baseFood * 2);
  });
});

describe('issue 017 — round-end cleanup wipes both queues', () => {
  it('defense:clear-modifiers expires unconsumed modifiers', () => {
    const G = seedFreshGame(4);
    resolveTrackCard(G, detRandom(), quietCouncil);
    expect(hasModifierActive(G, 'suppressEventsThisRound')).toBe(true);
    expect(G.track!.activeModifiers!.length).toBe(1);

    const stubCtx = {
      numPlayers: 4,
      currentPlayer: '0',
      activePlayers: null,
    } as unknown as Ctx;
    const stubRandom: HookRandomAPI = {
      Shuffle: <T>(arr: T[]) => arr,
      Number: () => 0,
      D6: () => 1,
    };
    runRoundEndHooks(G, stubCtx, stubRandom);

    expect(hasModifierActive(G, 'suppressEventsThisRound')).toBe(false);
    expect(G.track!.activeModifiers).toEqual([]);
  });
});
