// Adjacency content loader.
//
// Validates the active deck's adjacency.json at module load and exports
// a frozen ReadonlyArray. The validator + type live in
// `./adjacencyValidator.ts` so the test fixture's adjacency shim can
// reach the validator without bouncing through the test alias on this
// file.

import { pickFromGlob } from './deckSelection.ts';
import { validateBuildings } from './schema.ts';
import {
  validateAdjacencyRules,
  type AdjacencyRuleDef,
} from './adjacencyValidator.ts';

export { validateAdjacencyRules };
export type { AdjacencyRuleDef };

const ADJACENCY_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/adjacency.json',
  { eager: true, import: 'default' },
);
const BUILDINGS_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/buildings.json',
  { eager: true, import: 'default' },
);
const adjacencyRaw = pickFromGlob(ADJACENCY_BY_DECK, 'adjacency.json');
const buildingsRaw = pickFromGlob(BUILDINGS_BY_DECK, 'buildings.json');

// Issue 015 — `index.ts` re-exports `ADJACENCY_RULES`, which would
// create a load-time cycle if this file imported `BUILDINGS` from the
// barrel. Reach for the same raw + validator the barrel uses.
const BUILDINGS = validateBuildings(buildingsRaw);

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) Object.freeze(entry);
  return Object.freeze(arr);
};

const knownBuildingNames: ReadonlySet<string> = new Set(
  BUILDINGS.map((b) => b.name),
);

export const ADJACENCY_RULES: ReadonlyArray<AdjacencyRuleDef> = deepFreezeArray(
  validateAdjacencyRules(adjacencyRaw, knownBuildingNames),
);
