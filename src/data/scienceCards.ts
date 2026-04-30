// Typed loader for src/data/scienceCards.json — mirrors the pattern in
// src/data/index.ts but lives in its own file because ScienceCardDef is
// specific to the Science role (05.x) and references ResourceBag from
// src/game/resources, which the generic data barrel does not.
//
// As with the other loaders, validation runs at module load — if the JSON
// drifts out of shape, importing this file throws synchronously.

import scienceCardsRaw from './scienceCards.json';
import { RESOURCES } from '../game/resources/types.ts';
import type { ResourceBag } from '../game/resources/types.ts';

export type ScienceTier = 'beginner' | 'intermediate' | 'advanced';
export type ScienceColor = 'red' | 'gold' | 'green' | 'blue';
export type ScienceLevel = 0 | 1 | 2 | 3;

export interface ScienceCardDef {
  id: string;
  tier: ScienceTier;
  color: ScienceColor;
  level: ScienceLevel;
  // Stored as a partial bag (only the resources actually demanded appear as
  // keys). Tests / consumers can normalize via `bagOf(cost)` when they need a
  // full ResourceBag — see src/game/resources/bag.ts.
  cost: Partial<ResourceBag>;
  prereqIDs?: string[];
}

const TIERS: ReadonlySet<ScienceTier> = new Set([
  'beginner',
  'intermediate',
  'advanced',
]);

const COLORS: ReadonlySet<ScienceColor> = new Set([
  'red',
  'gold',
  'green',
  'blue',
]);

const LEVELS: ReadonlySet<ScienceLevel> = new Set([0, 1, 2, 3]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validateScienceCards = (raw: unknown): ScienceCardDef[] => {
  if (!Array.isArray(raw)) {
    throw new Error(
      `ScienceCardDef: expected an array, got ${typeof raw}`,
    );
  }
  return raw.map((entry, i) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `ScienceCardDef[${i}]: expected an object, got ${typeof entry}`,
      );
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `ScienceCardDef[${i}]: field "id" must be a non-empty string`,
      );
    }
    const tier = entry.tier;
    if (typeof tier !== 'string' || !TIERS.has(tier as ScienceTier)) {
      throw new Error(
        `ScienceCardDef[${i}]: field "tier" must be one of beginner|intermediate|advanced, got ${String(tier)}`,
      );
    }
    const color = entry.color;
    if (typeof color !== 'string' || !COLORS.has(color as ScienceColor)) {
      throw new Error(
        `ScienceCardDef[${i}]: field "color" must be one of red|gold|green|blue, got ${String(color)}`,
      );
    }
    const level = entry.level;
    if (typeof level !== 'number' || !LEVELS.has(level as ScienceLevel)) {
      throw new Error(
        `ScienceCardDef[${i}]: field "level" must be 0|1|2|3, got ${String(level)}`,
      );
    }
    const costRaw = entry.cost;
    if (!isPlainObject(costRaw)) {
      throw new Error(
        `ScienceCardDef[${i}]: field "cost" must be an object`,
      );
    }
    const cost: Partial<ResourceBag> = {};
    for (const [key, value] of Object.entries(costRaw)) {
      if (!(RESOURCES as ReadonlyArray<string>).includes(key)) {
        throw new Error(
          `ScienceCardDef[${i}]: cost key "${key}" is not a known resource`,
        );
      }
      if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
        throw new Error(
          `ScienceCardDef[${i}]: cost.${key} must be a non-negative number, got ${String(value)}`,
        );
      }
      // Index by Resource literal — RESOURCES.includes narrowed key above.
      (cost as Record<string, number>)[key] = value;
    }
    let prereqIDs: string[] | undefined;
    if (entry.prereqIDs !== undefined) {
      if (!Array.isArray(entry.prereqIDs)) {
        throw new Error(
          `ScienceCardDef[${i}]: field "prereqIDs" must be an array if present`,
        );
      }
      prereqIDs = entry.prereqIDs.map((p, pi) => {
        if (typeof p !== 'string') {
          throw new Error(
            `ScienceCardDef[${i}].prereqIDs[${pi}] must be a string, got ${typeof p}`,
          );
        }
        return p;
      });
    }
    const card: ScienceCardDef = {
      id,
      tier: tier as ScienceTier,
      color: color as ScienceColor,
      level: level as ScienceLevel,
      cost,
    };
    if (prereqIDs !== undefined) card.prereqIDs = prereqIDs;
    return card;
  });
};

const deepFreezeArray = <T extends object>(arr: T[]): ReadonlyArray<T> => {
  for (const entry of arr) Object.freeze(entry);
  return Object.freeze(arr);
};

export const SCIENCE_CARDS: ReadonlyArray<ScienceCardDef> = deepFreezeArray(
  validateScienceCards(scienceCardsRaw),
);
