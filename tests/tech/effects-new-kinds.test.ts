// Issue 019 — coverage for the new EventEffect tech-passive kinds.
//
// Tests one round-trip for each new kind:
//   - producePerRound: tech in domestic.techHand → runProduceForSeat
//     adds the bag.
//   - unitStatBump: tech in defense.techHand → resolveThreat sees the
//     unit fire with bumped strength.
//   - unlockCard: applyTechOnPlay routes the effect through
//     applyUnlockCard, adding the named def to the right hand.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import {
  applyTechOnPlay,
  applyUnlockCard,
} from '../../src/game/tech/effects.ts';
import { runProduceForSeat } from '../../src/game/roles/domestic/produce.ts';
import { resolveThreat } from '../../src/game/track/resolver.ts';
import { fromBgio, type BgioRandomLike, type RandomAPI } from '../../src/game/random.ts';
import { seedFreshGame } from '../helpers/factories.ts';
import type { TechnologyDef } from '../../src/data/schema.ts';
import type { ThreatCard } from '../../src/data/schema.ts';
import type { UnitInstance } from '../../src/game/roles/defense/types.ts';
import type { DomesticBuilding } from '../../src/game/roles/domestic/types.ts';
import { CENTER_CELL_KEY, cellKey } from '../../src/game/roles/domestic/grid.ts';

const identityBgio: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

const detRandom = (): RandomAPI => fromBgio(identityBgio);

const stubCtx: Ctx = {
  numPlayers: 4,
  playOrder: ['0', '1', '2', '3'],
  playOrderPos: 0,
  currentPlayer: '0',
  turn: 0,
  phase: 'othersPhase',
  activePlayers: {},
} as unknown as Ctx;

const baseTech = (overrides: Partial<TechnologyDef> = {}): TechnologyDef => ({
  branch: 'Test',
  name: 'TestTech',
  order: '',
  cost: '',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
  ...overrides,
});

describe('issue 019 — producePerRound passive', () => {
  it('runProduceForSeat adds the passive bag once per produce call', () => {
    const G = seedFreshGame(4);
    // The seed already has a domestic grid + mats. Domestic seat is '2'
    // in 4-player. Snapshot the baseline produce, then add a tech with
    // producePerRound to the seat's techHand and re-run produce.
    runProduceForSeat(G, '2');
    const baseline = { ...G.mats!['2']!.out };

    G.domestic!.producedThisRound = false;
    G.mats!['2']!.out = { ...baseline };
    // Reset every resource to baseline; produce should add the passive.
    G.domestic!.techHand = [
      baseTech({
        name: 'Cooking',
        passiveEffects: [{ kind: 'producePerRound', bag: { food: 1 } }],
      }),
    ];

    runProduceForSeat(G, '2');
    expect(G.mats!['2']!.out.food).toBe(baseline.food + 1);
  });
});

describe('issue 019 — unitStatBump passive', () => {
  it('layers a +strength bump onto a matching unit at fire time', () => {
    const G = seedFreshGame(4);
    G.domestic = {
      hand: [],
      grid: {
        [CENTER_CELL_KEY]: {
          defID: 'Center',
          upgrades: 0,
          worker: null,
          hp: 99,
          maxHp: 99,
          isCenter: true,
        } as DomesticBuilding,
      },
    };
    // Place a single Spearman at (0,1). The seed factory's defense slot
    // may not exist; build it explicitly.
    const sp: UnitInstance = {
      id: 'u-1',
      defID: 'Spearman',
      cellKey: cellKey(0, 1),
      hp: 1,
      placementOrder: 0,
      drillToken: false,
      taughtSkills: [],
    } as UnitInstance;
    G.defense = { hand: [], inPlay: [sp], techHand: [
      baseTech({
        name: 'Smithing',
        passiveEffects: [
          {
            kind: 'unitStatBump',
            stat: 'strength',
            amount: 100, // huge so the threat dies regardless of base attack
            matchUnit: 'Spearman',
          },
        ],
      }),
    ] };

    const t: ThreatCard = {
      id: 't1',
      kind: 'threat',
      name: 'Test Threat',
      phase: 1,
      description: '',
      direction: 'N',
      offset: 0,
      strength: 5,
    };
    const goldBefore = G.bank.gold;
    resolveThreat(G, detRandom(), t);
    // Threat should die (massively bumped Spearman attack), giving no
    // damage to bank.
    // Center burn would reduce gold; passing means no center burn.
    expect(G.bank.gold).toBe(goldBefore);
  });
});

describe('issue 019 — unlockCard effect', () => {
  it('applyUnlockCard pushes a building into G.domestic.hand', () => {
    const G = seedFreshGame(4);
    if (G.domestic === undefined) G.domestic = { hand: [], grid: {} };
    else G.domestic.hand = [];

    const did = applyUnlockCard(G, 'Trading Post', 'building');
    expect(did).toBe(true);
    expect(G.domestic!.hand.some((b) => b.name === 'Trading Post')).toBe(true);
  });

  it('applyTechOnPlay routes onPlayEffects[].unlockCard through the unlock helper', () => {
    const G = seedFreshGame(4);
    if (G.domestic === undefined) G.domestic = { hand: [], grid: {} };
    else G.domestic.hand = [];

    const tech = baseTech({
      name: 'TestUnlocker',
      onPlayEffects: [
        { kind: 'unlockCard', ref: 'Trading Post', refKind: 'building' },
      ],
    });

    const did = applyTechOnPlay(G, stubCtx, detRandom(), '2', tech);
    expect(did).toBe(true);
    expect(G.domestic!.hand.some((b) => b.name === 'Trading Post')).toBe(true);
  });
});
