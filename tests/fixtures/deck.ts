// Test-only fixture deck. Lives in `tests/fixtures/deck/` as JSON; this
// module reads the JSON, runs the *same* validators as production, and
// exports the same names production exports from `src/data/index.ts`.
//
// Wired in via `tests/setup.ts` (a Vitest setupFile) — every test that
// transitively imports from `src/data/*` gets these values, so engine
// behaviour is tested against a stable fixture rather than whichever
// content deck happens to be configured for production.
//
// **The three "live deck linter" tests opt out** with `vi.unmock(...)`
// and import the live JSON directly. Search for `vi.unmock` to find
// them.

import buildingsRaw from './deck/buildings.json';
import unitsRaw from './deck/units.json';
import technologiesRaw from './deck/technologies.json';
// `events.json` is read by `./fixtureEvents.ts` (re-exported below).
import trackCardsRaw from './deck/trackCards.json';
import adjacencyRaw from './deck/adjacency.json';

import {
  validateBuildings,
  validateUnits,
  validateTechnologies,
  validateTrackCards,
} from '../../src/data/schema.ts';
import type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
  TrackCardDef,
} from '../../src/data/schema.ts';
import {
  validateAdjacencyRules,
  type AdjacencyRuleDef,
} from '../../src/data/adjacencyValidator.ts';
import type { ResourceBag } from '../../src/game/resources/types.ts';

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) Object.freeze(entry);
  return Object.freeze(arr);
};

export const BUILDINGS: ReadonlyArray<BuildingDef> = deepFreezeArray(
  validateBuildings(buildingsRaw),
);

export const UNITS: ReadonlyArray<UnitDef> = deepFreezeArray(
  validateUnits(unitsRaw),
);

export const TECHNOLOGIES: ReadonlyArray<TechnologyDef> = deepFreezeArray(
  validateTechnologies(technologiesRaw),
);

// Same shape as the production loader — the fixture's events file
// already follows the EventCardDef contract.
export { EVENT_CARDS, type EventCardDef, type EventColor } from './fixtureEvents.ts';

// Track cards: validate-only here. Cross-card invariants (every phase
// populated, exactly one boss in phase 10, unique ids) are enforced in
// `src/data/trackCards.ts`. The fixture honors those invariants by
// construction; tests that want to assert the invariant logic itself
// can build their own bad inputs.
const deepFreezeTrackCards = (
  arr: TrackCardDef[],
): ReadonlyArray<TrackCardDef> => {
  for (const entry of arr) {
    if (entry.kind === 'threat' && entry.modifiers) Object.freeze(entry.modifiers);
    if (entry.kind === 'boss') {
      Object.freeze(entry.thresholds);
      Object.freeze(entry.attackPattern);
      for (const ap of entry.attackPattern) Object.freeze(ap);
    }
    Object.freeze(entry);
  }
  return Object.freeze(arr);
};

export const TRACK_CARDS: ReadonlyArray<TrackCardDef> = deepFreezeTrackCards(
  validateTrackCards(trackCardsRaw),
);

// Adjacency rules — validated against the fixture's own building set.
const knownBuildingNames = new Set(BUILDINGS.map((b) => b.name));
export const ADJACENCY_RULES: ReadonlyArray<AdjacencyRuleDef> = deepFreezeArray(
  validateAdjacencyRules(adjacencyRaw, knownBuildingNames),
);

// Re-export type aliases the production barrel re-exports, so test
// imports don't need a different module path.
export type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
  PlacementBonus,
  PlacementEffect,
  TrackCardDef,
  ThreatCard,
  BoonCard,
  ModifierCard,
  BossCard,
  ThreatPattern,
  BossThresholds,
  Direction,
  LibraryTier,
  LibraryColor,
} from '../../src/data/schema.ts';
export type { AdjacencyRuleDef } from '../../src/data/adjacencyValidator.ts';

// Cost helpers — identical contract to production.
export const buildingCost = (def: BuildingDef): Partial<ResourceBag> =>
  def.costBag ?? { gold: def.cost };
export const unitCost = (def: UnitDef): Partial<ResourceBag> =>
  def.costBag ?? { gold: def.cost };

export const BENEFIT_TOKENS = [
  'food',
  'production',
  'science',
  'gold',
  'attack',
  'happiness',
] as const;

export type BenefitToken = (typeof BENEFIT_TOKENS)[number];
