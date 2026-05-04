// Defense redesign 2.2 — track state on G + setup.
//
// Verifies the `buildTrack` / `peekNext` / `peekFollowing` / `advanceTrack`
// helpers in `src/game/track.ts` and that `setup` populates `G.track`
// correctly. The boss-last invariant ride-alongs the loader contract from
// 2.1 (exactly one boss card, in phase 10): after concatenating the
// per-phase piles in ascending order, the boss must sit at the very end
// of `upcoming`. Phase 2.7 (boss resolution) relies on that.

import { describe, expect, it } from 'vitest';
import { TRACK_CARDS } from '../../src/data/index.ts';
import type { TrackCardDef } from '../../src/data/index.ts';
import {
  buildTrack,
  peekNext,
  peekFollowing,
  advanceTrack,
} from '../../src/game/track.ts';
import type { TrackState } from '../../src/game/track.ts';
import type { RandomAPI } from '../../src/game/random.ts';
import { makeClient } from '../helpers/makeClient.ts';

// Identity-shuffle random — preserves input order. Useful for asserting
// per-phase pile boundaries without actually shuffling content.
const identityRandom = (): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr],
  pickOne: <T>(arr: ReadonlyArray<T>): T => {
    if (arr.length === 0) {
      throw new Error('pickOne: empty array');
    }
    return arr[0]!;
  },
  rangeInt: (lo: number) => lo,
});

// Reverse-shuffle random — flips array order. Lets us prove that
// `buildTrack` actually calls `random.shuffle` on the per-phase piles
// (and not, say, the source list as a whole) by inspecting first/last
// of each phase pile.
const reverseRandom = (): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => [...arr].reverse(),
  pickOne: <T>(arr: ReadonlyArray<T>): T => {
    if (arr.length === 0) {
      throw new Error('pickOne: empty array');
    }
    return arr[arr.length - 1]!;
  },
  rangeInt: (_lo: number, hi: number) => hi - 1,
});

const collectPhases = (cards: ReadonlyArray<TrackCardDef>): number[] =>
  cards.map((c) => c.phase);

describe('buildTrack (defense redesign 2.2)', () => {
  it('produces an upcoming list whose phases are monotonically non-decreasing', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    const phases = collectPhases(t.upcoming);
    for (let i = 1; i < phases.length; i++) {
      expect(
        phases[i]! >= phases[i - 1]!,
        `phase at index ${i} (${phases[i]}) must be >= prior phase (${phases[i - 1]})`,
      ).toBe(true);
    }
  });

  it('preserves every card from the source list (counts match)', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    expect(t.upcoming.length).toBe(TRACK_CARDS.length);
    // Ids round-trip — no card lost, no card duplicated.
    const sourceIDs = new Set(TRACK_CARDS.map((c) => c.id));
    const trackIDs = new Set(t.upcoming.map((c) => c.id));
    expect(trackIDs.size).toBe(sourceIDs.size);
    for (const id of sourceIDs) {
      expect(trackIDs.has(id), `id ${id} missing from track`).toBe(true);
    }
  });

  it('places the boss card as the very last entry of upcoming', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    const last = t.upcoming[t.upcoming.length - 1];
    expect(last).toBeDefined();
    expect(last!.kind).toBe('boss');
    expect(last!.phase).toBe(10);
  });

  it('history starts empty and currentPhase reflects the next card', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    expect(t.history).toEqual([]);
    expect(t.currentPhase).toBe(t.upcoming[0]!.phase);
  });

  it('shuffles each phase pile independently (reverse-shuffle witness)', () => {
    // Group source by phase, sort by phase, then within each pile reverse
    // the order. That's what `buildTrack` should produce when fed
    // reverseRandom — if it instead reversed the whole concatenated list
    // (or the per-phase piles in the wrong order) the assertion fails.
    const byPhase = new Map<number, TrackCardDef[]>();
    for (const c of TRACK_CARDS) {
      const arr = byPhase.get(c.phase) ?? [];
      arr.push(c);
      byPhase.set(c.phase, arr);
    }
    const expected: TrackCardDef[] = [];
    const phases = [...byPhase.keys()].sort((a, b) => a - b);
    for (const p of phases) {
      expected.push(...[...byPhase.get(p)!].reverse());
    }

    const t = buildTrack(reverseRandom(), TRACK_CARDS);
    expect(t.upcoming.map((c) => c.id)).toEqual(expected.map((c) => c.id));
    // Boss invariant survives the reverse: phase 10 has only the boss
    // (per loader contract), so reversing a singleton pile is a no-op
    // and the boss is still last.
    expect(t.upcoming[t.upcoming.length - 1]!.kind).toBe('boss');
  });

  it('handles an empty source list without throwing', () => {
    const t = buildTrack(identityRandom(), []);
    expect(t.upcoming).toEqual([]);
    expect(t.history).toEqual([]);
    expect(t.currentPhase).toBe(1);
  });
});

describe('peekNext / peekFollowing', () => {
  it('peekNext returns the first upcoming card', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    expect(peekNext(t)).toBe(t.upcoming[0]);
  });

  it('peekNext returns undefined when upcoming is empty', () => {
    const t: TrackState = { upcoming: [], history: [], currentPhase: 1 };
    expect(peekNext(t)).toBeUndefined();
  });

  it('peekFollowing(N) returns the first N upcoming cards (clamped)', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    const five = peekFollowing(t, 5);
    expect(five).toHaveLength(5);
    expect(five[0]).toBe(t.upcoming[0]);
    expect(five[4]).toBe(t.upcoming[4]);

    // Clamp at upcoming.length when N exceeds it.
    const huge = peekFollowing(t, t.upcoming.length + 100);
    expect(huge).toHaveLength(t.upcoming.length);

    // 0 / negative produce an empty array rather than throwing.
    expect(peekFollowing(t, 0)).toEqual([]);
    expect(peekFollowing(t, -3)).toEqual([]);
  });

  it('peekFollowing returns a fresh array (mutating it does not affect upcoming)', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    const before = t.upcoming.length;
    const slice = peekFollowing(t, 3);
    slice.length = 0;
    expect(t.upcoming.length).toBe(before);
  });
});

describe('advanceTrack', () => {
  it('returns and removes the next card; appends it to history', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    const initialFirst = t.upcoming[0];
    const initialLength = t.upcoming.length;

    const advanced = advanceTrack(t);
    expect(advanced).toBe(initialFirst);
    expect(t.upcoming.length).toBe(initialLength - 1);
    expect(t.history.length).toBe(1);
    expect(t.history[0]).toBe(initialFirst);
  });

  it('refreshes currentPhase to the new next card', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    // Walk forward until we cross a phase boundary, asserting along the way.
    let prev = t.currentPhase;
    let observedBoundary = false;
    for (let i = 0; i < t.upcoming.length + 5 && t.upcoming.length > 0; i++) {
      const advanced = advanceTrack(t);
      if (advanced === undefined) break;
      const nowPhase = t.currentPhase;
      expect(nowPhase >= prev).toBe(true);
      if (nowPhase > prev) observedBoundary = true;
      prev = nowPhase;
    }
    expect(observedBoundary).toBe(true);
  });

  it('returns undefined and leaves state stable when upcoming is empty', () => {
    const t: TrackState = { upcoming: [], history: [], currentPhase: 1 };
    const result = advanceTrack(t);
    expect(result).toBeUndefined();
    expect(t.upcoming).toEqual([]);
    expect(t.history).toEqual([]);
    expect(t.currentPhase).toBe(1);
  });

  it('the final advance pops the boss; currentPhase stays sensible', () => {
    const t = buildTrack(identityRandom(), TRACK_CARDS);
    let last: TrackCardDef | undefined;
    while (t.upcoming.length > 0) {
      last = advanceTrack(t);
    }
    expect(last).toBeDefined();
    expect(last!.kind).toBe('boss');
    expect(t.upcoming).toEqual([]);
    // After the final advance, currentPhase falls back to the just-advanced
    // card's phase rather than resetting — keeps UI labels sensible.
    expect(t.currentPhase).toBe(last!.phase);
    expect(t.history.length).toBe(TRACK_CARDS.length);
  });
});

describe('setup populates G.track', () => {
  it('G.track is built from TRACK_CARDS and the boss is last', () => {
    const client = makeClient({ numPlayers: 4, seed: 'track-spec' });
    const G = client.getState()!.G;
    expect(G.track).toBeDefined();
    expect(G.track!.upcoming.length).toBe(TRACK_CARDS.length);
    expect(G.track!.history).toEqual([]);
    expect(G.track!.upcoming[0]!.phase).toBe(G.track!.currentPhase);
    const last = G.track!.upcoming[G.track!.upcoming.length - 1];
    expect(last!.kind).toBe('boss');
  });

  it('the same seed produces the same track (determinism contract)', () => {
    const a = makeClient({ numPlayers: 4, seed: 'determinism-seed' });
    const b = makeClient({ numPlayers: 4, seed: 'determinism-seed' });
    const aIDs = a.getState()!.G.track!.upcoming.map((c) => c.id);
    const bIDs = b.getState()!.G.track!.upcoming.map((c) => c.id);
    expect(aIDs).toEqual(bIDs);
  });

  it('different seeds produce different tracks (not pinned, but probabilistic check)', () => {
    // Across enough phase piles with >1 cards, two distinct seeds will
    // diverge in shuffle order with overwhelming probability. If this
    // ever flakes, swap to comparing raw shuffle output via a stub.
    const a = makeClient({ numPlayers: 4, seed: 'seed-A' });
    const b = makeClient({ numPlayers: 4, seed: 'seed-B' });
    const aIDs = a.getState()!.G.track!.upcoming.map((c) => c.id);
    const bIDs = b.getState()!.G.track!.upcoming.map((c) => c.id);
    expect(aIDs).not.toEqual(bIDs);
  });
});
