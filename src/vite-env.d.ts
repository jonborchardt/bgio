/// <reference types="vite/client" />

// `?live` suffix on data-loader imports (used by tests/data/liveDeck.test.ts
// to bypass the fixture alias regex). Vite resolves the bare `?live`
// query at runtime; tsc can't follow it, so we mirror the public
// surface of the module using `typeof import('./data')`. Keep these
// names in sync with `src/data/index.ts`.
declare module '*?live' {
  export const BUILDINGS: typeof import('../src/data').BUILDINGS;
  export const UNITS: typeof import('../src/data').UNITS;
  export const TECHNOLOGIES: typeof import('../src/data').TECHNOLOGIES;
  export const EVENT_CARDS: typeof import('../src/data').EVENT_CARDS;
  export const TRACK_CARDS: typeof import('../src/data').TRACK_CARDS;
  export const ADJACENCY_RULES: typeof import('../src/data').ADJACENCY_RULES;
  export const BENEFIT_TOKENS: typeof import('../src/data').BENEFIT_TOKENS;
  export const buildingCost: typeof import('../src/data').buildingCost;
  export const unitCost: typeof import('../src/data').unitCost;
}
