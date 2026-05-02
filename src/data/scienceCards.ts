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

// ---------------------------------------------------------------------------
// Canonical science card view.
//
// Gameplay treats every (color, tier, level) cell as the SAME science card —
// only the cost varies, and the cell-level rewards (4 random techs from the
// matching branch) are determined by color, not by which variant was placed.
// External code that wants to talk about "Gold L2 Advanced" as a single
// thing — the relationships graph, the per-card `?` info modal, the
// autocomplete picker — should use this canonical view, not the raw variant
// list.
//
// Game logic (setup, science slice) keeps using the per-variant SCIENCE_CARDS
// list above; only the registry / UI layers consume the canonical view.
//
// Canonical id format: `${color}-${tier}-L${level}` (no `science:` prefix —
// the registry adds that). Each canonical entry exposes its variants array
// so consumers can list the cost options.
// ---------------------------------------------------------------------------

export interface CanonicalScienceCardDef {
  /** Stable canonical key derived from coordinates. */
  id: string;
  color: ScienceColor;
  tier: ScienceTier;
  level: ScienceLevel;
  /** All cost variants for this cell, in the order they appear in the
   *  source JSON. Each variant carries its own raw `id` and `cost`. */
  variants: ReadonlyArray<ScienceCardDef>;
}

export const canonicalScienceCardId = (
  coords: { color: ScienceColor; tier: ScienceTier; level: ScienceLevel },
): string => `${coords.color}-${coords.tier}-L${coords.level}`;

const buildCanonicalScienceCards = (
  cards: ReadonlyArray<ScienceCardDef>,
): CanonicalScienceCardDef[] => {
  const groups = new Map<string, ScienceCardDef[]>();
  for (const card of cards) {
    const key = canonicalScienceCardId(card);
    const arr = groups.get(key);
    if (arr) arr.push(card);
    else groups.set(key, [card]);
  }
  return [...groups.entries()].map(([id, variants]) => {
    const head = variants[0];
    return {
      id,
      color: head.color,
      tier: head.tier,
      level: head.level,
      variants: Object.freeze([...variants]),
    };
  });
};

const deepFreezeCanonical = (
  arr: CanonicalScienceCardDef[],
): ReadonlyArray<CanonicalScienceCardDef> => {
  for (const c of arr) Object.freeze(c);
  return Object.freeze(arr);
};

export const SCIENCE_CANONICAL_CARDS: ReadonlyArray<CanonicalScienceCardDef> =
  deepFreezeCanonical(buildCanonicalScienceCards(SCIENCE_CARDS));
