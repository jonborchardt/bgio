// Tests for scienceContribute (05.2).
//
// Driven by direct calls to the move function form against a hand-built
// SettlementState + stub Ctx, in the same style as
// `tests/roles/chief/distribute.test.ts`. The grid + paid ledger are
// stubbed in directly (not via `setupScience`) so each test can pin a
// known set of cards and per-card costs without depending on the JSON
// content. Stage gating is exercised by setting `ctx.activePlayers`
// explicitly.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { scienceContribute } from '../../../src/game/roles/science/contribute.ts';
import { bagOf } from '../../../src/game/resources/bag.ts';
import { assignRoles } from '../../../src/game/roles.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { ScienceCardDef } from '../../../src/data/scienceCards.ts';
import type { ScienceState } from '../../../src/game/roles/science/setup.ts';
import type { SettlementState } from '../../../src/game/types.ts';
import { initialMats } from '../../../src/game/resources/playerMat.ts';

// Three blue cards in the same column, levels 0/1/2 — the simplest possible
// "lowest-first rule" fixture.
const blue0: ScienceCardDef = {
  id: 'blue-0',
  tier: 'beginner',
  color: 'blue',
  level: 0,
  cost: { gold: 5 },
};
const blue1: ScienceCardDef = {
  id: 'blue-1',
  tier: 'intermediate',
  color: 'blue',
  level: 1,
  cost: { gold: 4, science: 1 },
};
const blue2: ScienceCardDef = {
  id: 'blue-2',
  tier: 'advanced',
  color: 'blue',
  level: 2,
  cost: { gold: 3, science: 2 },
};

const buildScienceState = (
  completed: string[] = [],
  paidOverrides: Record<string, Partial<ResourceBag>> = {},
): ScienceState => {
  const cards = [blue0, blue1, blue2];
  const paid: Record<string, ResourceBag> = {};
  const underCards: Record<string, never[]> = {};
  for (const c of cards) {
    paid[c.id] = bagOf(paidOverrides[c.id] ?? {});
    underCards[c.id] = [];
  }
  return {
    grid: [cards],
    underCards,
    paid,
    completed: [...completed],
    perRoundCompletions: 0,
    hand: [],
  };
};

// Builds a 2-player state where seat '0' is chief+science and seat '1' is
// domestic+defense. The science seat (seat '0') gets a stash seeded by
// `walletOf` even though the canonical 2p layout puts science on the chief
// seat (which normally has no mat) — for these tests we want the
// contribute move to have something to draw from, so we bend the rule
// and synthesize a mat for the chief-stacked science seat.
const build2pState = (
  walletOf: Partial<ResourceBag>,
  scienceState: ScienceState,
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const mats = initialMats(roleAssignments);
  // Synthesize a mat for the chief-stacked science seat so the test's
  // contribute move has a stash to draw from.
  mats['0'] = {
    in: bagOf({}),
    out: bagOf({}),
    stash: bagOf(walletOf),
  };

  const hands: Record<string, unknown> = {};
  for (const seat of Object.keys(roleAssignments)) hands[seat] = {};

  return {
    bank: bagOf({}),
    centerMat: {},
    roleAssignments,
    round: 1,
    bossResolved: false,
    hands,
    mats,
    science: scienceState,
  };
};

const ctxScienceTurn = (seat: string): Ctx =>
  ({
    phase: 'othersPhase',
    activePlayers: { [seat]: 'scienceTurn' },
  }) as unknown as Ctx;

const callContribute = (
  G: SettlementState,
  playerID: string | undefined,
  ctx: Ctx,
  cardID: string,
  amounts: Partial<ResourceBag>,
): typeof INVALID_MOVE | void => {
  const mv = scienceContribute as unknown as (
    args: { G: SettlementState; ctx: Ctx; playerID: string | undefined },
    cardID: string,
    amounts: Partial<ResourceBag>,
  ) => typeof INVALID_MOVE | void;
  return mv({ G, ctx, playerID }, cardID, amounts);
};

describe('scienceContribute (05.2)', () => {
  it('happy path: 2 gold of a 5-gold card lands in paid; wallet drops by 2', () => {
    const G = build2pState({ gold: 5 }, buildScienceState());

    const result = callContribute(G, '0', ctxScienceTurn('0'), 'blue-0', {
      gold: 2,
    });

    expect(result).toBeUndefined();
    expect(G.science!.paid['blue-0']).toEqual(bagOf({ gold: 2 }));
    expect(G.mats['0']?.stash).toEqual(bagOf({ gold: 3 }));
  });

  it('paying more than the wallet holds returns INVALID_MOVE; state unchanged', () => {
    const G = build2pState({ gold: 1 }, buildScienceState());
    const before = JSON.parse(JSON.stringify(G));

    const result = callContribute(G, '0', ctxScienceTurn('0'), 'blue-0', {
      gold: 5,
    });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('paying a higher-level card while a lower-level same-color card is unfinished is INVALID_MOVE', () => {
    // No completions yet — blue-0 (level 0) is the lowest, so paying blue-1
    // (level 1) must be rejected.
    const G = build2pState({ gold: 5 }, buildScienceState());
    const before = JSON.parse(JSON.stringify(G));

    const result = callContribute(G, '0', ctxScienceTurn('0'), 'blue-1', {
      gold: 3,
    });

    expect(result).toBe(INVALID_MOVE);
    expect(G).toEqual(before);
  });

  it('paying a higher-level card after lower-levels complete is allowed', () => {
    // blue-0 and blue-1 are already completed; blue-2 is now the lowest
    // non-completed card in the column.
    const science = buildScienceState(['blue-0', 'blue-1']);
    const G = build2pState({ gold: 3, science: 2 }, science);

    const result = callContribute(G, '0', ctxScienceTurn('0'), 'blue-2', {
      gold: 3,
      science: 2,
    });

    expect(result).toBeUndefined();
    expect(G.science!.paid['blue-2']).toEqual(bagOf({ gold: 3, science: 2 }));
    expect(G.mats['0']?.stash).toEqual(bagOf({}));
  });

  it('overpay caps at remaining cost; excess stays in the wallet', () => {
    // blue-0 cost is 5 gold; pre-pay 2 gold so the remaining cost is 3.
    // Caller asks to drop 10 gold — only 3 should land on the card; the
    // other 7 stays in the wallet (10 - 3 = 7).
    const science = buildScienceState([], { 'blue-0': { gold: 2 } });
    const G = build2pState({ gold: 10 }, science);

    const result = callContribute(G, '0', ctxScienceTurn('0'), 'blue-0', {
      gold: 10,
    });

    expect(result).toBeUndefined();
    expect(G.science!.paid['blue-0']).toEqual(bagOf({ gold: 5 }));
    expect(G.mats['0']?.stash).toEqual(bagOf({ gold: 7 }));
  });
});
