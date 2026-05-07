// Resource token types and the empty bag constant.
// Pure types and a frozen constant — no runtime deps, no boardgame.io imports.

// Canonical iteration / display order. Drives token rows on the chief
// editor, science cost rows, mat tile token strips, and the regex
// alternation in `ResourceText` (any order works for matching, but
// using the same order keeps the data flat). Keep this in sync with
// `RESOURCE_DISPLAY` and `EMPTY_BAG` below.
export const RESOURCES = [
  'gold',
  'production',
  'wood',
  'stone',
  'steel',
  'science',
  'food',
  'worker',
  'horse',
  'happiness',
] as const;

export type Resource = (typeof RESOURCES)[number];

export type ResourceBag = Record<Resource, number>;

export const EMPTY_BAG: Readonly<ResourceBag> = Object.freeze({
  gold: 0,
  production: 0,
  wood: 0,
  stone: 0,
  steel: 0,
  science: 0,
  food: 0,
  worker: 0,
  horse: 0,
  happiness: 0,
});

// User-facing display names + single-letter symbols. Kept as a layer over
// the canonical identifiers (which still appear in JSON content, tests,
// and palette keys) so the rename is purely presentational. Symbols are
// chosen to disambiguate where first letters collide:
//   stone=S → steel=T, science=C
//   wood=W → worker=L (also renamed to "Labor")
//   horse=H → happiness=A (also renamed to "Approval")
export const RESOURCE_DISPLAY: Readonly<
  Record<Resource, { name: string; symbol: string }>
> = Object.freeze({
  gold: { name: 'Gold', symbol: 'G' },
  production: { name: 'Production', symbol: 'P' },
  wood: { name: 'Wood', symbol: 'W' },
  stone: { name: 'Stone', symbol: 'S' },
  steel: { name: 'Steel', symbol: 'T' },
  science: { name: 'Science', symbol: 'C' },
  food: { name: 'Food', symbol: 'F' },
  worker: { name: 'Labor', symbol: 'L' },
  horse: { name: 'Horse', symbol: 'H' },
  happiness: { name: 'Approval', symbol: 'A' },
});
