// 12.1 — Named seed strings reusable across test files.
//
// Tests that want reproducible bgio random behavior pass these seeds into
// `makeClient({ seed: SEEDS.STABLE })`. Centralizing the names here keeps
// fuzz / unit / e2e tests speaking the same vocabulary, and means a future
// "swap one seed because it surfaces a known regression" change touches one
// file instead of every spec.
//
// The strings themselves are arbitrary — bgio's PRNG just hashes them.
// Naming them by *intent* (RECRUIT_HEAVY etc.) tells a reader why the
// fixture chose a particular seed without forcing them to grep moves.
export const SEEDS = {
  /** A neutral, reproducible seed. The default for tests that just want
   *  determinism without caring about specific draws. */
  STABLE: 'test-seed-stable',
  /** A seed empirically biased toward recruit-heavy openings — useful for
   *  Foreign role tests that want the unit pile populated quickly. The
   *  bias is incidental (bgio's PRNG hashes the string) but lets us
   *  pin known-good fuzz fixtures by name. */
  RECRUIT_HEAVY: 'test-seed-recruits',
  /** A seed that surfaces interesting economy paths (resource production
   *  tests). Same caveat as `RECRUIT_HEAVY` — the property is empirical. */
  ECONOMY: 'test-seed-economy',
} as const;

export type SeedName = keyof typeof SEEDS;
