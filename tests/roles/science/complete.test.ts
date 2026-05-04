// Tests for scienceComplete (05.3).
//
// Driven by direct calls to the move function form against a hand-built
// SettlementState + stub Ctx. Tech cards under each science card are
// stubbed as four `TechnologyDef`-shaped objects so the distribution-by-
// color invariant is observable without depending on the bundled JSON.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceComplete } from '../../../src/game/roles/science/complete.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { ScienceCardDef } from '../../../src/data/scienceCards.ts';
import type { ScienceState } from '../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import type { TechnologyDef } from '../../../src/data/schema.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

const techStub = (name: string, branch: string): TechnologyDef => ({
  branch,
  name,
  order: '1',
  cost: '1',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
});

const fourTech = (prefix: string, branch: string): TechnologyDef[] => [
  techStub(`${prefix}-1`, branch),
  techStub(`${prefix}-2`, branch),
  techStub(`${prefix}-3`, branch),
  techStub(`${prefix}-4`, branch),
];

// One card per color. Costs are tiny (1 gold) so tests can pre-stage `paid`
// to cover them with a one-liner.
const redCard: ScienceCardDef = {
  id: 'red-0',
  tier: 'beginner',
  color: 'red',
  level: 0,
  cost: { gold: 1 },
};
const goldCard: ScienceCardDef = {
  id: 'gold-0',
  tier: 'beginner',
  color: 'gold',
  level: 0,
  cost: { gold: 1 },
};
const greenCard: ScienceCardDef = {
  id: 'green-0',
  tier: 'beginner',
  color: 'green',
  level: 0,
  cost: { gold: 1 },
};
const blueCard: ScienceCardDef = {
  id: 'blue-0',
  tier: 'beginner',
  color: 'blue',
  level: 0,
  cost: { gold: 1 },
};

const buildScienceState = (opts: {
  paid?: Record<string, Partial<ResourceBag>>;
  completed?: string[];
  perRoundCompletions?: number;
} = {}): ScienceState => {
  const cards: ScienceCardDef[][] = [
    [redCard],
    [goldCard],
    [greenCard],
    [blueCard],
  ];
  const paid: Record<string, ResourceBag> = {};
  const underCards: Record<string, TechnologyDef[]> = {};
  for (const col of cards) {
    for (const c of col) {
      paid[c.id] = bagOf(opts.paid?.[c.id] ?? {});
    }
  }
  underCards[redCard.id] = fourTech('red', 'Fighting');
  underCards[goldCard.id] = fourTech('gold', 'Exploration');
  underCards[greenCard.id] = fourTech('green', 'Civic');
  underCards[blueCard.id] = fourTech('blue', 'Education');
  return {
    grid: cards,
    underCards,
    paid,
    completed: [...(opts.completed ?? [])],
    perRoundCompletions: opts.perRoundCompletions ?? 0,
    hand: [],
  };
};

// Helper: build a SettlementState for the given player count where every
// non-chief seat has an empty mat (in / out / stash), and the seat holding
// `science` is whatever the assignment table assigns. The science slice is
// supplied directly. We seed empty hand fields on the chief / domestic /
// defense slices so the test can read them without `?.`.
const buildState = (
  numPlayers: 1 | 2 | 3 | 4,
  scienceState: ScienceState,
): SettlementState => {
  const roleAssignments = assignRoles(numPlayers);
  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    settlementsJoined: 0,
    hands,
    mats: initialMats(roleAssignments),
    science: scienceState,
    defense: {
      hand: [],
      inPlay: [],
    },
    chief: { workers: 0, hand: [] },
    domestic: { hand: [], grid: {}, techHand: [] },
  };
};

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const callComplete = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  cardID: string,
): typeof INVALID_MOVE | void => {
  const mv = scienceComplete as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, cardID);
};

// Resolves the seat that holds `role` for the given player count, matching
// the tables in src/game/roles.ts.
const seatHoldingRole = (
  numPlayers: 1 | 2 | 3 | 4,
  role: 'chief' | 'science' | 'domestic' | 'defense',
): string => {
  const a = assignRoles(numPlayers);
  for (const [seat, roles] of Object.entries(a)) {
    if (roles.includes(role)) return seat;
  }
  throw new Error(`no seat for ${role} in ${numPlayers}p`);
};

describe('scienceComplete (05.3)', () => {
  it('successful completion: paid resources move to bank, card is marked complete, tech cards distribute by color', () => {
    // 4-player: each role has its own seat, so we can verify that the right
    // seat's slice receives each color's tech stack.
    const science = buildScienceState({
      paid: { 'blue-0': { gold: 1 } },
    });
    const G = buildState(4, science);
    const scienceSeat = seatHoldingRole(4, 'science');

    const result = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'blue-0');

    expect(result).toBeUndefined();
    expect(G.science!.completed).toEqual(['blue-0']);
    expect(G.science!.perRoundCompletions).toBe(1);
    // Resources accounted for in the bank.
    expect(G.bank).toEqual(bagOf({ gold: 1 }));
    // Paid ledger reset.
    expect(G.science!.paid['blue-0']).toEqual(bagOf({}));
    // Blue tech cards land on the science hand.
    expect(G.science!.hand).toHaveLength(4);
    expect(G.science!.hand.map((t) => t.name)).toEqual([
      'blue-1',
      'blue-2',
      'blue-3',
      'blue-4',
    ]);

    // Now drive a red completion to confirm Defense-side delivery.
    G.science!.perRoundCompletions = 0; // simulate a fresh round
    G.science!.paid['red-0'] = bagOf({ gold: 1 });
    callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'red-0');
    expect(G.defense!.techHand).toHaveLength(4);

    // Gold completion → chief hand.
    G.science!.perRoundCompletions = 0;
    G.science!.paid['gold-0'] = bagOf({ gold: 1 });
    callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'gold-0');
    expect(G.chief!.hand).toHaveLength(4);

    // Green completion → domestic techHand (06.1 renamed the Domestic
    // tech slot from `hand` to `techHand` so the building-card hand can
    // own the unqualified `hand` slot).
    G.science!.perRoundCompletions = 0;
    G.science!.paid['green-0'] = bagOf({ gold: 1 });
    callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'green-0');
    expect(G.domestic!.techHand).toHaveLength(4);
  });

  it('completing with paid < cost is INVALID_MOVE; state unchanged', () => {
    const science = buildScienceState({
      paid: { 'blue-0': {} }, // nothing paid
    });
    const G = buildState(4, science);
    const scienceSeat = seatHoldingRole(4, 'science');
    const before = JSON.parse(JSON.stringify(G));

    const result = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'blue-0');

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('completing twice in one round: second call returns INVALID_MOVE', () => {
    const science = buildScienceState({
      paid: { 'blue-0': { gold: 1 }, 'red-0': { gold: 1 } },
    });
    const G = buildState(4, science);
    const scienceSeat = seatHoldingRole(4, 'science');

    // First completion succeeds.
    const r1 = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'blue-0');
    expect(r1).toBeUndefined();
    expect(G.science!.perRoundCompletions).toBe(1);

    // Second one in the same round must be rejected.
    const before = JSON.parse(JSON.stringify(G));
    const r2 = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'red-0');
    expect(r2).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('after a round-end reset, a new completion is allowed', () => {
    const science = buildScienceState({
      paid: { 'blue-0': { gold: 1 }, 'red-0': { gold: 1 } },
      perRoundCompletions: 1, // simulate "already completed this round"
    });
    const G = buildState(4, science);
    const scienceSeat = seatHoldingRole(4, 'science');

    // While the counter is at 1, completion is gated.
    const blocked = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'blue-0');
    expect(blocked).toBe(INVALID_MOVE);

    // Manually clear the counter the way the round-end hook would.
    G.science!.perRoundCompletions = 0;

    const r2 = callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'blue-0');
    expect(r2).toBeUndefined();
    expect(G.science!.completed).toEqual(['blue-0']);
    expect(G.science!.perRoundCompletions).toBe(1);
  });

  it('1p / 2p / 3p / 4p role assignments: each color lands on the seat holding the matching role', () => {
    // 1-player: every role is on seat 0, so all four hands accumulate
    // there. Drive a single completion (blue) and assert the science hand
    // grows; the others stay touched only by their own completions.
    {
      const science = buildScienceState({ paid: { 'blue-0': { gold: 1 } } });
      const G = buildState(1, science);
      const seat = seatHoldingRole(1, 'science');
      expect(seat).toBe('0');
      callComplete(G, seat, ctxScienceTurn(seat), 'blue-0');
      // In 1p, the science seat holds every role — so the science hand,
      // chief hand, domestic hand, and defense hand all live on seat '0'.
      expect(G.science!.hand).toHaveLength(4);
    }

    // 2-player: seat '0' holds chief+science, seat '1' holds domestic+defense.
    {
      const science = buildScienceState({
        paid: { 'red-0': { gold: 1 } },
      });
      const G = buildState(2, science);
      const scienceSeat = seatHoldingRole(2, 'science');
      const defenseSeat = seatHoldingRole(2, 'defense');
      expect(scienceSeat).toBe('0');
      expect(defenseSeat).toBe('1');
      callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'red-0');
      // Red → Defense → seat '1' owns G.defense; the move pushes onto the
      // shared Defense techHand slice. We don't index by seat for the global
      // role slices (the role-holding seat owns the slice as a whole).
      expect(G.defense!.techHand).toHaveLength(4);
    }

    // 3-player: seat '0' chief+science, seat '1' domestic, seat '2' defense.
    {
      const science = buildScienceState({
        paid: { 'green-0': { gold: 1 } },
      });
      const G = buildState(3, science);
      const scienceSeat = seatHoldingRole(3, 'science');
      expect(seatHoldingRole(3, 'domestic')).toBe('1');
      callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'green-0');
      expect(G.domestic!.techHand).toHaveLength(4);
    }

    // 4-player: each role on its own seat.
    {
      const science = buildScienceState({
        paid: { 'gold-0': { gold: 1 } },
      });
      const G = buildState(4, science);
      const scienceSeat = seatHoldingRole(4, 'science');
      expect(seatHoldingRole(4, 'chief')).toBe('0');
      callComplete(G, scienceSeat, ctxScienceTurn(scienceSeat), 'gold-0');
      expect(G.chief!.hand).toHaveLength(4);
    }
  });
});
