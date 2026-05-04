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

export type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
  PlacementBonus,
  PlacementEffect,
} from './schema.ts';

import type { BuildingDef as _BuildingDef, UnitDef as _UnitDef } from './schema.ts';
import type { ResourceBag } from '../game/resources/types.ts';

/**
 * Single source of truth for "what does buying this building actually cost?"
 * Returns `def.costBag` when the data row carries a multi-resource cost,
 * else falls back to `{ gold: def.cost }`. Callers pay/check via this helper
 * so a future widening of `BuildingDef.cost` (e.g. removing the legacy
 * scalar entirely) only touches one place.
 */
export const buildingCost = (
  def: _BuildingDef,
): Partial<ResourceBag> => def.costBag ?? { gold: def.cost };

/**
 * Single source of truth for "what does recruiting one of this unit cost?"
 * Mirrors `buildingCost`: returns `def.costBag` when present, else
 * `{ gold: def.cost }`. Domestic-side recruit-cost modifiers (Forge: -1
 * gold) are layered on top in [src/game/roles/foreign/recruit.ts] — this
 * helper is the **base** cost, before any in-play discount.
 */
export const unitCost = (
  def: _UnitDef,
): Partial<ResourceBag> => def.costBag ?? { gold: def.cost };

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
