// Thin wrappers over bgio's random plugin (provided as `random` to setup
// and moves). Call sites read better as `const r = fromBgio(random); r.shuffle(deck);`
// than as `random.Shuffle(deck)` scattered across the codebase, and the
// `RandomAPI` shape lets us hand a deterministic stub to unit tests that
// don't want to spin up a full bgio client.
//
// Manual `Math.random` is banned in `src/` (see eslint.config.js) — every
// random number must trace back to bgio's seedable PRNG so two clients
// started with the same seed produce identical state.

export interface RandomAPI {
  shuffle<T>(arr: ReadonlyArray<T>): T[];
  pickOne<T>(arr: ReadonlyArray<T>): T;
  rangeInt(loInc: number, hiExc: number): number;
}

// Structural shape of bgio's random plugin object. We pin the few methods
// we actually use rather than dragging in bgio's internal plugin types,
// which keeps `fromBgio` callable both from real bgio call sites and from
// tests passing in hand-rolled stubs.
//
// `Shuffle` is typed with a mutable `T[]` parameter to match bgio 0.50's
// own signature exactly. Tests that pass a `ReadonlyArray<T>` should copy
// (`[...arr]`) at the boundary; this wrapper does that for them via the
// internal `slice()` calls below.
export interface BgioRandomLike {
  Shuffle: <T>(arr: T[]) => T[];
  Number: () => number;
}

export const fromBgio = (random: BgioRandomLike): RandomAPI => ({
  shuffle: <T>(arr: ReadonlyArray<T>): T[] => random.Shuffle([...arr]),
  // `Shuffle` returns a fresh array, so taking index 0 is safe and gives
  // us a uniformly-random element without a separate `random.Number` call.
  pickOne: <T>(arr: ReadonlyArray<T>): T => {
    if (arr.length === 0) {
      throw new Error('pickOne: cannot pick from an empty array');
    }
    return random.Shuffle([...arr])[0] as T;
  },
  rangeInt: (loInc: number, hiExc: number): number => {
    if (!(hiExc > loInc)) {
      throw new Error(
        `rangeInt: hiExc (${hiExc}) must be strictly greater than loInc (${loInc})`,
      );
    }
    return Math.floor(random.Number() * (hiExc - loInc)) + loInc;
  },
});
