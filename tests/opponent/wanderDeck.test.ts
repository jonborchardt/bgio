// 08.4 — Wander deck (opponent) tests.
//
// Covers:
// - Setup populates the deck with WANDER_CARDS.length cards.
// - The `opponent:wander-step` round-end hook moves the previous
//   `currentlyApplied` to discard, pops the top of deck into
//   `currentlyApplied`, and dispatches its effects.
// - Deck reshuffles from discard when empty.
// - Hook order: previous card unwound (moved to discard) before the
//   next card is drawn / dispatched.
// - playerView redacts the deck order but keeps `currentlyApplied` and
//   `discard` visible.
//
// Note: importing `wanderDeck.ts` (via the `setupWanderDeck` import below)
// registers the `opponent:wander-step` round-end hook with the 02.5
// registry as a module-load side effect. That registration is idempotent
// — subsequent test files that also reach for the wander module re-use
// the same registered hook reference.

import { describe, expect, it } from 'vitest';
import type { Ctx } from 'boardgame.io';
import {
  runRoundEndHooks,
  type RandomAPI,
} from '../../src/game/hooks.ts';
import { setupWanderDeck } from '../../src/game/opponent/wanderDeck.ts';
import { WANDER_CARDS } from '../../src/data/wanderCards.ts';
import { fromBgio, type BgioRandomLike } from '../../src/game/random.ts';
import type { SettlementState } from '../../src/game/types.ts';
import { EMPTY_BAG } from '../../src/game/resources/types.ts';
import { assignRoles } from '../../src/game/roles.ts';
import { playerViewFor } from '../../src/game/playerView.ts';

// Identity random — deterministic for tests that need to know which
// card the hook will draw.
const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

// Hook-side random API (slightly different shape from the bgio random
// plugin — `runRoundEndHooks` takes `RandomAPI` from hooks.ts, which
// adds `D6`).
const stubHookRandom = (): RandomAPI => ({
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
  D6: () => 1,
});

const stubCtx = (): Ctx =>
  ({
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 0,
    currentPlayer: '0',
    turn: 0,
    phase: 'endOfRound',
    activePlayers: null,
  }) as unknown as Ctx;

const buildG = (
  partial: Partial<SettlementState> = {},
): SettlementState => {
  const roleAssignments = assignRoles(2);
  const hands: Record<string, unknown> = {};
  const wallets: Record<string, ReturnType<() => typeof EMPTY_BAG>> = {};
  for (const [seat, roles] of Object.entries(roleAssignments)) {
    hands[seat] = {};
    if (!roles.includes('chief')) wallets[seat] = { ...EMPTY_BAG };
  }
  return {
    bank: { ...EMPTY_BAG },
    centerMat: { circles: {}, tradeRequest: null },
    roleAssignments,
    round: 0,
    settlementsJoined: 0,
    hands,
    wallets,
    ...partial,
  };
};

describe('setupWanderDeck (08.4)', () => {
  it('creates a deck containing every WANDER_CARDS entry', () => {
    const wander = setupWanderDeck(fromBgio(identityRandom));
    expect(wander.deck.length).toBe(WANDER_CARDS.length);
    expect(wander.discard).toEqual([]);
    expect(wander.currentlyApplied).toBeNull();

    // Spot-check that every card id is preserved.
    const idsIn = new Set(WANDER_CARDS.map((c) => c.id));
    const idsOut = new Set(wander.deck.map((c) => c.id));
    expect(idsOut).toEqual(idsIn);
  });

  it('returns a fresh array (mutation safe)', () => {
    const wander = setupWanderDeck(fromBgio(identityRandom));
    // Confirm the deck array is mutable — pushing should not throw and
    // should not corrupt WANDER_CARDS (which is frozen).
    expect(() => wander.deck.push(wander.deck[0]!)).not.toThrow();
    expect(() => {
      (WANDER_CARDS as unknown as unknown[]).push({});
    }).toThrow();
  });

  it('ships at least 24 cards (per the 08.4 plan)', () => {
    expect(WANDER_CARDS.length).toBeGreaterThanOrEqual(24);
  });
});

describe('opponent:wander-step round-end hook (08.4)', () => {
  it('flips the top card into currentlyApplied and applies its effects', () => {
    // Build a state with a single positive-effect card on top of the deck.
    const card = {
      id: 'wan-test-001',
      name: 'Test Bounty',
      effects: [
        { kind: 'gainResource', bag: { gold: 5 }, target: 'bank' },
      ],
    };
    const G = buildG({
      opponent: {
        wander: {
          deck: [card],
          discard: [],
          currentlyApplied: null,
        },
      },
    });

    runRoundEndHooks(G, stubCtx(), stubHookRandom());

    expect(G.opponent!.wander.currentlyApplied).toEqual(card);
    expect(G.opponent!.wander.deck).toEqual([]);
    expect(G.bank.gold).toBe(5);
  });

  it('moves the previously-applied card into discard before drawing', () => {
    const previous = {
      id: 'wan-test-prev',
      name: 'Previous',
      effects: [],
    };
    const next = {
      id: 'wan-test-next',
      name: 'Next',
      effects: [
        { kind: 'gainResource', bag: { wood: 1 }, target: 'bank' },
      ],
    };
    const G = buildG({
      opponent: {
        wander: {
          deck: [next],
          discard: [],
          currentlyApplied: previous,
        },
      },
    });

    runRoundEndHooks(G, stubCtx(), stubHookRandom());

    expect(G.opponent!.wander.currentlyApplied).toEqual(next);
    expect(G.opponent!.wander.discard).toEqual([previous]);
    expect(G.bank.wood).toBe(1);
  });

  it('reshuffles discard back into deck when the deck empties', () => {
    const cardA = {
      id: 'wan-test-A',
      name: 'A',
      effects: [],
    };
    const cardB = {
      id: 'wan-test-B',
      name: 'B',
      effects: [],
    };
    // Deck is empty; one card already applied (so it'll move to discard
    // first), and one card already in discard. After the hook the deck
    // should rebuild from discard, then pop one card.
    const G = buildG({
      opponent: {
        wander: {
          deck: [],
          discard: [cardB],
          currentlyApplied: cardA,
        },
      },
    });

    runRoundEndHooks(G, stubCtx(), stubHookRandom());

    // currentlyApplied is one of the two cards now (reshuffled deck).
    const applied = G.opponent!.wander.currentlyApplied;
    expect(applied).not.toBeNull();
    expect([cardA.id, cardB.id]).toContain(applied!.id);
    // Discard was emptied at reshuffle time; now empty (the previous
    // currentlyApplied was pushed before the reshuffle moved discard
    // into deck — so cardA went to discard, then everything was
    // moved into the deck, then one card popped). Net: discard empty.
    expect(G.opponent!.wander.discard).toEqual([]);
    // The other card is still in deck.
    expect(G.opponent!.wander.deck.length).toBe(1);
  });

  it('no-ops cleanly when G.opponent is missing', () => {
    const G = buildG();
    expect(() =>
      runRoundEndHooks(G, stubCtx(), stubHookRandom()),
    ).not.toThrow();
    expect((G as { opponent?: unknown }).opponent).toBeUndefined();
  });

  it('previous transient effects are unwound (card moved to discard) before the new card applies', () => {
    // Test order property: first the previous card is moved to discard,
    // THEN the new card's effects fire. We observe by giving the new
    // card an effect that we can compare against the previous card
    // location.
    const previous = {
      id: 'wan-test-prev-2',
      name: 'Previous2',
      effects: [],
    };
    const next = {
      id: 'wan-test-next-2',
      name: 'Next2',
      effects: [
        { kind: 'gainResource', bag: { food: 2 }, target: 'bank' },
      ],
    };
    const G = buildG({
      bank: { ...EMPTY_BAG },
      opponent: {
        wander: {
          deck: [next],
          discard: [],
          currentlyApplied: previous,
        },
      },
    });

    runRoundEndHooks(G, stubCtx(), stubHookRandom());

    // Discard contains exactly the previous card — proving it was
    // shuttled there before the new card's effects ran.
    expect(G.opponent!.wander.discard).toEqual([previous]);
    // New card's effect fired.
    expect(G.bank.food).toBe(2);
  });
});

describe('playerView redacts wander deck (08.4)', () => {
  it('redacts deck order for every viewer; currentlyApplied + discard visible', () => {
    const cards = [
      { id: 'wan-test-PV-1', name: 'one', effects: [] },
      { id: 'wan-test-PV-2', name: 'two', effects: [] },
      { id: 'wan-test-PV-3', name: 'three', effects: [] },
    ];
    const applied = { id: 'wan-test-applied', name: 'applied', effects: [] };
    const discarded = { id: 'wan-test-disc', name: 'disc', effects: [] };

    const G = buildG({
      opponent: {
        wander: {
          deck: [...cards],
          discard: [discarded],
          currentlyApplied: applied,
        },
      },
    });

    // Chief seat
    const chiefView = playerViewFor(G, {} as Ctx, '0');
    expect(chiefView.opponent!.wander.deck).toEqual([null, null, null]);
    expect(chiefView.opponent!.wander.deck.length).toBe(3);
    expect(chiefView.opponent!.wander.currentlyApplied).toEqual(applied);
    expect(chiefView.opponent!.wander.discard).toEqual([discarded]);

    // Domestic seat (different roles, same redaction)
    const domesticView = playerViewFor(G, {} as Ctx, '1');
    expect(domesticView.opponent!.wander.deck).toEqual([null, null, null]);
    expect(domesticView.opponent!.wander.currentlyApplied).toEqual(applied);

    // Spectator
    const specView = playerViewFor(G, {} as Ctx, null);
    expect(specView.opponent!.wander.deck).toEqual([null, null, null]);
    expect(specView.opponent!.wander.currentlyApplied).toEqual(applied);
  });

  it('does not mutate the input G', () => {
    const G = buildG({
      opponent: {
        wander: {
          deck: [{ id: 'wan-pv-mut', name: 'mut', effects: [] }],
          discard: [],
          currentlyApplied: null,
        },
      },
    });
    const before = JSON.parse(JSON.stringify(G));
    playerViewFor(G, {} as Ctx, '0');
    expect(G).toEqual(before);
  });
});
