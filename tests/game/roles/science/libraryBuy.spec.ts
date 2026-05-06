// SL 3.1 — `scienceLibraryBuy` move tests.
//
// Direct against a hand-built (G, ctx) fixture, mirroring the pattern
// in tests/game/roles/science/drill.spec.ts. The library state is
// seeded with synthetic LibraryCards so we can exercise discount /
// floor / handoff paths without needing tagged real content.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceLibraryBuy } from '../../../../src/game/roles/science/libraryBuy.ts';
import { assignRoles } from '../../../../src/game/roles.ts';
import { bagOf } from '../../../../src/game/resources/bag.ts';
import { initialMats } from '../../../../src/game/resources/playerMat.ts';
import type { ScienceState } from '../../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../../src/game/types.ts';
import type { ResourceBag } from '../../../../src/game/resources/types.ts';
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

const fakeUnit = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  name = `${scienceColor}-u-${tier}`,
): LibraryCard => ({
  kind: 'unit',
  tier,
  scienceColor,
  def: {
    name,
    cost: 0,
    initiative: 0,
    attack: 0,
    hp: 1,
    altStats: '',
    requires: '',
    note: '',
    range: 1,
    regen: 0,
    firstStrike: false,
    placementBonus: [],
    tier,
    scienceColor,
  },
});

const fakeTech = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  name = `${scienceColor}-t-${tier}`,
): LibraryCard => ({
  kind: 'tech',
  tier,
  scienceColor,
  def: {
    branch: '',
    name,
    order: '',
    cost: '',
    buildings: '',
    units: '',
    blueEvent: '',
    greenEvent: '',
    redEvent: '',
    goldEvent: '',
    tier,
    scienceColor,
  },
});

const fakeEvent = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  name = `${scienceColor}-e-${tier}`,
): LibraryCard => ({
  kind: 'event',
  tier,
  scienceColor,
  def: {
    id: name,
    color: scienceColor,
    name,
    effects: [],
    tier,
    scienceColor,
  },
});

interface BuildOpts {
  stash?: Partial<ResourceBag>;
  rowCards?: ReadonlyArray<LibraryCard | null>;
  tableau?: ReadonlyArray<LibraryCard>;
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
  const seats = Object.keys(roleAssignments);
  const lib = emptyLibraryState(seats);
  if (opts.rowCards !== undefined) {
    for (let i = 0; i < lib.row.length; i++) {
      lib.row[i] = opts.rowCards[i] ?? null;
    }
  }
  if (opts.tableau !== undefined) {
    lib.discountTableaus['1'] = [...opts.tableau];
  }

  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science,
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [], techHand: [] },
    chief: { workers: 0, hand: [] },
    library: lib,
  };
};

const callBuy = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  slot: number,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBuy as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, slot);
};

describe('scienceLibraryBuy (SL 3.1)', () => {
  it('happy path — green T1: pays 4 wood, lands in domestic.hand, tableau grows, slot null', () => {
    const card = fakeBuilding('green', 1);
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [card, null, null, null, null, null],
    });
    const result = callBuy(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBeUndefined();
    expect(G.mats['1']!.stash.wood).toBe(1);
    expect(G.bank.wood).toBe(4);
    expect(G.domestic!.hand).toHaveLength(1);
    expect(G.domestic!.hand[0]!.name).toBe(card.def.name);
    expect(G.library!.discountTableaus['1']).toHaveLength(1);
    expect(G.library!.row[0]).toBeNull();
  });

  it('INVALID_MOVE when slot is null', () => {
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [null, null, null, null, null, null],
    });
    const result = callBuy(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']!.stash.wood).toBe(5);
  });

  it('INVALID_MOVE when slot index is out of range', () => {
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    expect(callBuy(G, '1', ctxScienceTurn('1'), -1)).toBe(INVALID_MOVE);
    expect(callBuy(G, '1', ctxScienceTurn('1'), 6)).toBe(INVALID_MOVE);
  });

  it('INVALID_MOVE when stash is short of effective cost', () => {
    const G = build4pState({
      stash: { wood: 1 },
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    const result = callBuy(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBe(INVALID_MOVE);
    expect(G.mats['1']!.stash.wood).toBe(1);
    expect(G.library!.row[0]).not.toBeNull();
  });

  it('discount stack reduces cost on subsequent buys', () => {
    const card1 = fakeBuilding('green', 1, 'g1');
    const card2 = fakeBuilding('green', 1, 'g2');
    const G = build4pState({
      stash: { wood: 100 },
      rowCards: [card1, card2, null, null, null, null],
    });
    callBuy(G, '1', ctxScienceTurn('1'), 0); // pays 4, tableau=[card1]
    const woodAfterFirst = G.mats['1']!.stash.wood;
    expect(woodAfterFirst).toBe(96);
    callBuy(G, '1', ctxScienceTurn('1'), 1); // pays 3 (4 - 1 disc)
    expect(G.mats['1']!.stash.wood).toBe(93);
    expect(G.library!.discountTableaus['1']).toHaveLength(2);
  });

  it('floor-1: discount stack saturating below 1 still deducts 1', () => {
    // 5 green-T1 in tableau → -5 wood discount on a 4-wood T1 → floor 1.
    const tableau: LibraryCard[] = [];
    for (let i = 0; i < 5; i++) {
      tableau.push(fakeBuilding('green', 1, `pre-${i}`));
    }
    const card = fakeBuilding('green', 1, 'target');
    const G = build4pState({
      stash: { wood: 2 },
      rowCards: [card, null, null, null, null, null],
      tableau,
    });
    const result = callBuy(G, '1', ctxScienceTurn('1'), 0);
    expect(result).toBeUndefined();
    expect(G.mats['1']!.stash.wood).toBe(1);
  });

  it('recipient handoff: gold event → chief gold-event hand, blue → science, green → domestic, red → defense', () => {
    const goldCard = fakeEvent('gold', 1, 'g-card');
    const G = build4pState({
      stash: { gold: 50, science: 50, wood: 50, stone: 50 },
      rowCards: [
        goldCard,
        fakeTech('blue', 1, 'b-card'),
        fakeBuilding('green', 1, 'gr-card'),
        fakeUnit('red', 1, 'r-card'),
        null,
        null,
      ],
    });
    // Events slice required for gold-event routing.
    G.events = {
      decks: { gold: [], blue: [], green: [], red: [] },
      hands: { gold: {}, blue: {}, green: {}, red: {} },
      used: { gold: {}, blue: {}, green: {}, red: {} },
      playedThisRound: { '0': [], '1': [], '2': [], '3': [] },
    };
    callBuy(G, '1', ctxScienceTurn('1'), 0);
    callBuy(G, '1', ctxScienceTurn('1'), 1);
    callBuy(G, '1', ctxScienceTurn('1'), 2);
    callBuy(G, '1', ctxScienceTurn('1'), 3);
    // Chief seat is '0' in 4p; gold events route to its gold-event hand.
    expect(G.events.hands.gold['0']).toHaveLength(1);
    if (goldCard.kind !== 'event') throw new Error('expected event fixture');
    expect(G.events.hands.gold['0']![0]!.id).toBe(goldCard.def.id);
    // Chief tech hand is unchanged — gold events bypass it.
    expect(G.chief!.hand ?? []).toHaveLength(0);
    expect(G.science!.hand).toHaveLength(1);
    expect(G.domestic!.hand).toHaveLength(1);
    expect(G.defense!.hand).toHaveLength(1);
  });

  it('rejects when caller is not in scienceTurn stage', () => {
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '1': 'domesticTurn' },
    } as unknown as Ctx;
    expect(callBuy(G, '1', ctx, 0)).toBe(INVALID_MOVE);
  });

  it('rejects when caller does not hold science role', () => {
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    G.mats['2'] = { in: bagOf({}), out: bagOf({}), stash: bagOf({ wood: 5 }) };
    const ctx = {
      phase: 'othersPhase',
      activePlayers: { '2': 'scienceTurn' },
    } as unknown as Ctx;
    expect(callBuy(G, '2', ctx, 0)).toBe(INVALID_MOVE);
  });

  it('rejects when playerID is undefined', () => {
    const G = build4pState({
      stash: { wood: 5 },
      rowCards: [fakeBuilding('green', 1), null, null, null, null, null],
    });
    expect(callBuy(G, undefined, ctxScienceTurn('1'), 0)).toBe(INVALID_MOVE);
  });

  it('rejects when G.library is undefined', () => {
    const G = build4pState({ stash: { wood: 5 } });
    delete (G as { library?: unknown }).library;
    expect(callBuy(G, '1', ctxScienceTurn('1'), 0)).toBe(INVALID_MOVE);
  });
});
