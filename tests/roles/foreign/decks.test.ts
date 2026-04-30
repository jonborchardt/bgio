// 07.1 — Battle / Trade deck construction + secret-state redaction.
//
// The pure deck-builder is exercised against hand-rolled fixtures via the
// internal `__buildDeckForTest` export so we don't couple test invariants
// to whatever content currently lives in src/data/{battle,trade}Cards.json.
// The bgio integration assertions go through `makeClient` so we know setup
// wires the decks into G.foreign and the playerView redacts them for non-
// Foreign viewers.

import type { Ctx } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { makeClient } from '../../helpers/makeClient.ts';
import {
  buildBattleDeck,
  buildTradeDeck,
  __buildDeckForTest,
} from '../../../src/game/roles/foreign/decks.ts';
import { fromBgio, type BgioRandomLike } from '../../../src/game/random.ts';
import { playerViewFor } from '../../../src/game/playerView.ts';
import type { SettlementState } from '../../../src/game/types.ts';

// Deterministic identity-shuffle stub: lets us drive deck construction
// without spinning a full bgio client. Output is fully determined by the
// input order, so two invocations produce identical decks.
const identityRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr],
  Number: () => 0,
};

// A reverse-shuffle stub — useful for proving the shuffle is consulted on a
// per-group basis (each group's order is reversed; group order itself is
// number-ascending).
const reverseRandom: BgioRandomLike = {
  Shuffle: <T>(arr: T[]): T[] => [...arr].reverse(),
  Number: () => 0,
};

const fakeCtx = {} as Ctx;

describe('buildDeck (07.1)', () => {
  it('produces an empty deck from an empty content array', () => {
    const out = __buildDeckForTest([], fromBgio(identityRandom));
    expect(out).toEqual([]);
  });

  it('sorts groups in ascending number order; both number-1 cards before number-2', () => {
    // Three-card fixture: A and B share number 1, C has number 2. After
    // grouping + shuffle + concat, both number-1 cards must precede C.
    const A = { id: 'A', number: 1 };
    const B = { id: 'B', number: 1 };
    const C = { id: 'C', number: 2 };
    const out = __buildDeckForTest([A, B, C], fromBgio(identityRandom));

    expect(out).toHaveLength(3);
    expect(out.map((c) => c.number)).toEqual([1, 1, 2]);
    // The number-2 card must be last regardless of input ordering.
    expect(out[2]).toBe(C);
    // Both number-1 cards must precede the number-2 card (set membership of
    // the first two slots).
    expect(new Set([out[0]!.id, out[1]!.id])).toEqual(new Set(['A', 'B']));
  });

  it('shuffles within each number-group via the supplied random', () => {
    // Same fixture, reverse-shuffle stub: within the number-1 group the
    // input was [A, B] so the reversed group is [B, A]. Group ordering is
    // still ascending by number, so C lands last.
    const A = { id: 'A', number: 1 };
    const B = { id: 'B', number: 1 };
    const C = { id: 'C', number: 2 };
    const out = __buildDeckForTest([A, B, C], fromBgio(reverseRandom));
    expect(out.map((c) => c.id)).toEqual(['B', 'A', 'C']);
  });

  it('same RandomAPI input produces the same deck order across two calls', () => {
    // Determinism check on the pure builder: two invocations with the same
    // (deterministic) RandomAPI must yield identical outputs. This is the
    // deterministic-stub variant of the "same seed → same deck order"
    // invariant.
    const a = buildBattleDeck(fromBgio(identityRandom));
    const b = buildBattleDeck(fromBgio(identityRandom));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));

    const ta = buildTradeDeck(fromBgio(identityRandom));
    const tb = buildTradeDeck(fromBgio(identityRandom));
    expect(ta.map((c) => c.id)).toEqual(tb.map((c) => c.id));
  });

  it('two bgio clients started with the same seed produce identical decks', () => {
    // End-to-end determinism: bgio's seedable Random plugin drives the
    // setup-time shuffle, so two seeded clients must produce identical
    // battle and trade decks. We connect both clients as the Foreign seat
    // (seat '1' in 2-player) so the playerView leaves the deck order
    // visible — otherwise `client.getState().G` would surface the
    // redacted view.
    const a = makeClient({ seed: 'foreign-seed', playerID: '1' });
    const b = makeClient({ seed: 'foreign-seed', playerID: '1' });
    const fa = a.getState()!.G.foreign!;
    const fb = b.getState()!.G.foreign!;

    expect(fa.battleDeck.map((c) => c!.id)).toEqual(
      fb.battleDeck.map((c) => c!.id),
    );
    expect(fa.tradeDeck.map((c) => c!.id)).toEqual(
      fb.tradeDeck.map((c) => c!.id),
    );
  });

  it('decks are sorted ascending by number after the bgio-driven shuffle', () => {
    // Same caveat as above: connect as the Foreign seat to see unredacted
    // deck order.
    const c = makeClient({ seed: 'foreign-seed', playerID: '1' });
    const f = c.getState()!.G.foreign!;
    // Each deck's `number` field must be non-decreasing, since groups are
    // concatenated in ascending order.
    for (let i = 1; i < f.battleDeck.length; i++) {
      expect(f.battleDeck[i]!.number).toBeGreaterThanOrEqual(
        f.battleDeck[i - 1]!.number,
      );
    }
    for (let i = 1; i < f.tradeDeck.length; i++) {
      expect(f.tradeDeck[i]!.number).toBeGreaterThanOrEqual(
        f.tradeDeck[i - 1]!.number,
      );
    }
  });
});

describe('playerView redaction (07.1)', () => {
  // Grab the unredacted G via the Foreign seat (seat '1' in 2-player), then
  // drive `playerViewFor` directly to assert the redactor's behavior under
  // different viewer identities.
  const grabUnredactedG = (): SettlementState => {
    const c = makeClient({ seed: 'foreign-seed', playerID: '1' });
    return c.getState()!.G as SettlementState;
  };

  it('non-Foreign seat sees null[] for both decks of correct length', () => {
    const G = grabUnredactedG();
    const beforeBattle = G.foreign!.battleDeck.length;
    const beforeTrade = G.foreign!.tradeDeck.length;

    // Seat 0 holds chief+science in 2-player; not the Foreign seat.
    const view = playerViewFor(G, fakeCtx, '0');
    const fv = view.foreign!;

    expect(fv.battleDeck).toHaveLength(beforeBattle);
    expect(fv.tradeDeck).toHaveLength(beforeTrade);
    expect(fv.battleDeck.every((card) => card === null)).toBe(true);
    expect(fv.tradeDeck.every((card) => card === null)).toBe(true);
  });

  it('Foreign seat sees its own decks unredacted', () => {
    const G = grabUnredactedG();
    // Seat 1 holds domestic+foreign in 2-player.
    const view = playerViewFor(G, fakeCtx, '1');
    const fv = view.foreign!;

    expect(fv.battleDeck.map((card) => card!.id)).toEqual(
      G.foreign!.battleDeck.map((card) => card.id),
    );
    expect(fv.tradeDeck.map((card) => card!.id)).toEqual(
      G.foreign!.tradeDeck.map((card) => card.id),
    );
  });

  it('spectator (playerID = null) sees both decks redacted', () => {
    const G = grabUnredactedG();
    const view = playerViewFor(G, fakeCtx, null);
    const fv = view.foreign!;

    expect(fv.battleDeck.length).toBe(G.foreign!.battleDeck.length);
    expect(fv.tradeDeck.length).toBe(G.foreign!.tradeDeck.length);
    expect(fv.battleDeck.every((card) => card === null)).toBe(true);
    expect(fv.tradeDeck.every((card) => card === null)).toBe(true);
  });
});
