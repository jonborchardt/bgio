// SL 8 — Science Library headless integration tests.
//
// These tests exercise the buy / burn / refill / discount-tableau /
// boss-debuff loop end-to-end against hand-built `SettlementState`
// fixtures. Per the master plan + sub-plan 5.4, the bgio engine drives
// `scienceLibraryBuy` / `scienceLibraryBurn` / `scienceSeatDone` through
// the others-phase `scienceTurn` stage; we exercise the same code paths
// here without booting a full client because the move bodies are pure
// mutators — driving them via direct invocation matches the existing
// patterns in `tests/game/roles/science/library*.spec.ts` and keeps the
// integration concern (multiple moves composed across one round) the
// only variable.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceLibraryBuy } from '../../../src/game/roles/science/libraryBuy.ts';
import { scienceLibraryBurn } from '../../../src/game/roles/science/libraryBurn.ts';
import { scienceSeatDone } from '../../../src/game/roles/science/seatDone.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';
import {
  aggregateLibraryDebuffs,
  libraryDebuffLevel,
} from '../../../src/game/library/debuff.ts';
import {
  discountResource,
  effectiveResearchCost,
  researchCost,
} from '../../../src/game/library/costs.ts';
import { emptyLibraryState } from '../../../src/game/library/state.ts';
import type { ScienceState } from '../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../src/data/schema.ts';

const SCIENCE_SEAT = '1';

const ctxScienceTurn = (seat: string = SCIENCE_SEAT): Ctx =>
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
  stash?: Partial<ResourceBag>;
  rowCards?: ReadonlyArray<LibraryCard | null>;
  deckCards?: ReadonlyArray<LibraryCard>;
}

const build4pState = (opts: BuildOpts = {}): SettlementState => {
  const roleAssignments = assignRoles(4);
  const mats = initialMats(roleAssignments);
  if (opts.stash !== undefined) {
    mats[SCIENCE_SEAT] = {
      in: bagOf({}),
      out: bagOf({}),
      stash: bagOf(opts.stash),
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
  if (opts.deckCards !== undefined) {
    lib.deck = [...opts.deckCards];
  }

  return {
    bank: bagOf({}),
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: minimalScience(),
    domestic: { hand: [], grid: {}, techHand: [] },
    defense: { hand: [], inPlay: [], techHand: [] },
    chief: { workers: 0, hand: [] },
    library: lib,
  };
};

const callBuy = (
  G: SettlementState,
  slot: number,
  ctx: Ctx = ctxScienceTurn(),
  playerID: string = SCIENCE_SEAT,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBuy as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, slot);
};

const callBurn = (
  G: SettlementState,
  slot: number,
  ctx: Ctx = ctxScienceTurn(),
  playerID: string = SCIENCE_SEAT,
): typeof INVALID_MOVE | void => {
  const mv = scienceLibraryBurn as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string },
    slot: number,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, slot);
};

const callSeatDone = (
  G: SettlementState,
  ctx: Ctx = ctxScienceTurn(),
  playerID: string = SCIENCE_SEAT,
): unknown => {
  const mv = scienceSeatDone as unknown as (args: {
    G: SettlementState;
    ctx: Ctx;
    playerID: string;
  }) => unknown;
  return mv({ G, ctx, playerID });
};

describe('SL 8 — discount snowball across colors', () => {
  it('buying 3 cards across 3 colors records 3 distinct -1 discounts; 4th buy of one color is cheaper by 1', () => {
    // Pick three colors whose T1 primaries are distinct so each grants
    // a different -1: green→-1 wood, red→-1 stone, gold→-1 gold.
    const greenT1a = fakeBuilding('green', 1, 'green-T1-a');
    const redT1 = fakeBuilding('red', 1, 'red-T1');
    const goldT1 = fakeBuilding('gold', 1, 'gold-T1');
    // The 4th buy is a second green T1 to confirm the -1 wood discount
    // applies on the same-color follow-up.
    const greenT1b = fakeBuilding('green', 1, 'green-T1-b');
    const G = build4pState({
      stash: { wood: 50, stone: 50, gold: 50 },
      rowCards: [greenT1a, redT1, goldT1, greenT1b, null, null],
    });

    expect(callBuy(G, 0)).toBeUndefined();
    expect(callBuy(G, 1)).toBeUndefined();
    expect(callBuy(G, 2)).toBeUndefined();

    const tableau = G.library!.discountTableaus[SCIENCE_SEAT]!;
    expect(tableau).toHaveLength(3);
    const discountedResources = tableau.map((c) => discountResource(c)).sort();
    expect(discountedResources).toEqual(['gold', 'stone', 'wood']);

    // Stash has dropped by exactly the base T1 cost (4) per resource.
    expect(G.mats[SCIENCE_SEAT]!.stash.wood).toBe(46);
    expect(G.mats[SCIENCE_SEAT]!.stash.stone).toBe(46);
    expect(G.mats[SCIENCE_SEAT]!.stash.gold).toBe(46);

    // Fourth buy: another green T1. The base cost is 4 wood; the wood
    // discount in the tableau (1 from greenT1a) drops the effective
    // cost to 3.
    const beforeFourth = G.mats[SCIENCE_SEAT]!.stash.wood;
    const effective = effectiveResearchCost(greenT1b, tableau);
    expect(effective.wood).toBe(3);
    expect(callBuy(G, 3)).toBeUndefined();
    expect(G.mats[SCIENCE_SEAT]!.stash.wood).toBe(beforeFourth - 3);
    expect(G.library!.discountTableaus[SCIENCE_SEAT]).toHaveLength(4);
  });
});

describe('SL 8 — burn 5 then refill', () => {
  it('5 burns push 5 cards to lostIdeas; seat-done refills the row to 6', () => {
    const burnees: LibraryCard[] = [];
    for (let i = 0; i < 5; i += 1) {
      burnees.push(fakeBuilding('green', 1, `burn-${i}`));
    }
    // Slot 5 stays full so burning slots 0..4 leaves 5 nulls + 1 filled.
    const survivor = fakeBuilding('green', 1, 'survivor');
    // 5 deck cards so the refill can repopulate the 5 burned slots.
    const deck: LibraryCard[] = [];
    for (let i = 0; i < 5; i += 1) {
      deck.push(fakeBuilding('green', 2, `deck-${i}`));
    }
    const G = build4pState({
      rowCards: [...burnees, survivor],
      deckCards: deck,
    });

    for (let i = 0; i < 5; i += 1) {
      expect(callBurn(G, i)).toBeUndefined();
    }
    expect(G.library!.lostIdeas).toHaveLength(5);
    // Burn does not grow the discount tableau.
    expect(G.library!.discountTableaus[SCIENCE_SEAT]).toEqual([]);
    // Slots 0..4 are empty mid-turn; survivor remains at slot 5.
    expect(G.library!.row.slice(0, 5).every((s) => s === null)).toBe(true);
    expect(G.library!.row[5]!.def.name).toBe('survivor');

    callSeatDone(G);

    expect(G.library!.row.every((s) => s !== null)).toBe(true);
    expect(G.library!.row).toHaveLength(6);
    expect(G.library!.deck).toHaveLength(0);
    expect(G.othersDone![SCIENCE_SEAT]).toBe(true);
  });
});

describe('SL 8 — boss debuff aggregator at threshold 1', () => {
  it('5 buys of one color flips the aggregator level to 1 for that color', () => {
    const cards: LibraryCard[] = [];
    for (let i = 0; i < 5; i += 1) {
      cards.push(fakeBuilding('red', 1, `red-${i}`));
    }
    const G = build4pState({
      // T1 red costs 4 stone; with one -1 stone discount per card, the
      // five buys cost 4 + 3 + 2 + 1 + 1 = 11 stone (floor 1 on cards
      // 4 and 5).
      stash: { stone: 50 },
      rowCards: [...cards, null],
    });

    for (let i = 0; i < 5; i += 1) {
      expect(callBuy(G, i)).toBeUndefined();
    }

    expect(G.library!.discountTableaus[SCIENCE_SEAT]).toHaveLength(5);

    const debuffs = aggregateLibraryDebuffs(G);
    expect(debuffs.red).toBe(1);
    // Other colors stayed at 0 — only red was bought.
    expect(debuffs.gold).toBe(0);
    expect(debuffs.blue).toBe(0);
    expect(debuffs.green).toBe(0);
    // Same answer through the per-tableau primitive.
    expect(
      libraryDebuffLevel(
        G.library!.discountTableaus[SCIENCE_SEAT]!,
        'red',
      ),
    ).toBe(1);
  });
});

describe('SL 8 — empty deck does not break the round', () => {
  it('after the deck drains, buy is rejected on null slots but seat-done still flips and refill is a no-op', () => {
    // Empty row + empty deck: nothing to buy or burn. The starting state
    // mirrors a late-game turn where the science seat has bought / burned
    // through every printed card.
    const G = build4pState({
      stash: { wood: 50 },
      rowCards: [null, null, null, null, null, null],
      deckCards: [],
    });

    // Buys against null slots reject cleanly with INVALID_MOVE — the move
    // body's slot-card guard catches it before any payment.
    for (let i = 0; i < 6; i += 1) {
      expect(callBuy(G, i)).toBe(INVALID_MOVE);
    }
    // Stash is unchanged — no payment was taken.
    expect(G.mats[SCIENCE_SEAT]!.stash.wood).toBe(50);

    // Seat-done still works; row stays empty after refill (no deck).
    expect(callSeatDone(G)).toBeUndefined();
    expect(G.othersDone![SCIENCE_SEAT]).toBe(true);
    expect(G.library!.row.every((s) => s === null)).toBe(true);
    expect(G.library!.deck).toEqual([]);
  });

  it('drain across two turns: buy 3 of a 3-card deck, seat-done refills, buy 3 more, deck empty', () => {
    // Two-turn drain: the seat buys all 3 cards in the row, seat-done
    // refills from the 3-card deck, then the seat buys all 3 again. The
    // engine cleanly hands off — no INVALID_MOVE on legitimate buys, no
    // dangling discount-tableau growth, and the library state stays
    // structurally sound (row null, deck empty, lostIdeas empty).
    const round1: LibraryCard[] = [
      fakeBuilding('green', 1, 'r1-a'),
      fakeBuilding('green', 1, 'r1-b'),
      fakeBuilding('green', 1, 'r1-c'),
    ];
    const round2: LibraryCard[] = [
      fakeBuilding('green', 1, 'r2-a'),
      fakeBuilding('green', 1, 'r2-b'),
      fakeBuilding('green', 1, 'r2-c'),
    ];
    const G = build4pState({
      stash: { wood: 100 },
      rowCards: [round1[0]!, round1[1]!, round1[2]!, null, null, null],
      deckCards: round2,
    });

    expect(callBuy(G, 0)).toBeUndefined();
    expect(callBuy(G, 1)).toBeUndefined();
    expect(callBuy(G, 2)).toBeUndefined();
    expect(G.library!.discountTableaus[SCIENCE_SEAT]).toHaveLength(3);

    // End of turn 1: row is null at 0..2 / null at 3..5; deck has 3
    // cards; refill drags 3 cards into slots 0..2.
    callSeatDone(G);
    expect(G.library!.row[0]!.def.name).toBe('r2-a');
    expect(G.library!.row[1]!.def.name).toBe('r2-b');
    expect(G.library!.row[2]!.def.name).toBe('r2-c');
    expect(G.library!.row.slice(3).every((s) => s === null)).toBe(true);
    expect(G.library!.deck).toEqual([]);

    // Reset othersDone for "another science turn" (the round-end hook
    // does this in real play; we shortcut here to keep the test focused
    // on the library mechanic).
    G.othersDone = {};

    expect(callBuy(G, 0)).toBeUndefined();
    expect(callBuy(G, 1)).toBeUndefined();
    expect(callBuy(G, 2)).toBeUndefined();
    expect(G.library!.discountTableaus[SCIENCE_SEAT]).toHaveLength(6);

    // Seat-done after the deck is empty still flips done; no crash.
    expect(callSeatDone(G)).toBeUndefined();
    expect(G.othersDone![SCIENCE_SEAT]).toBe(true);
    expect(G.library!.row.every((s) => s === null)).toBe(true);
    expect(G.library!.deck).toEqual([]);
    expect(G.library!.lostIdeas).toEqual([]);
  });
});

describe('SL 8 — researchCost / effectiveResearchCost sanity for integration', () => {
  // Pin the cost numbers the snowball test relies on so a future cost-
  // table tune doesn't silently invalidate the discount-by-1 assertion.
  it('green T1 base cost is 4 wood; with one -1 wood discount it is 3', () => {
    const card = fakeBuilding('green', 1);
    expect(researchCost(card).wood).toBe(4);
    const tableau = [fakeBuilding('green', 1, 'pre')];
    expect(effectiveResearchCost(card, tableau).wood).toBe(3);
  });
});
