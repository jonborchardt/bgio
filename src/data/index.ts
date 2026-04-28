// Typed barrel for src/data/*.json. Validators run at module load — if any
// JSON file goes out of shape, importing this file throws synchronously
// (intentional crash-early). Logic everywhere else imports from here, never
// from the raw JSON files directly.

import buildingsRaw from './buildings.json';
import unitsRaw from './units.json';
import technologiesRaw from './technologies.json';
import {
  validateBuildings,
  validateUnits,
  validateTechnologies,
} from './schema.ts';
import type { BuildingDef, UnitDef, TechnologyDef } from './schema.ts';

export type { BuildingDef, UnitDef, TechnologyDef } from './schema.ts';

// Freeze both the array and every entry so accidental mutation in game logic
// crashes loudly (frozen-object writes throw in module strict mode).
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

// Verbs we know how to parse out of building `benefit` strings (and similar
// tokens elsewhere). Referenced by 06.3 — keep this list in sync with the
// parser there.
export const BENEFIT_TOKENS = [
  'food',
  'production',
  'science',
  'gold',
  'attack',
  'defense',
  'happiness',
  'unit maintenance',
] as const;

export type BenefitToken = (typeof BENEFIT_TOKENS)[number];
