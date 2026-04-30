// Typed shapes for the raw JSON content under src/data/*.json, plus tiny
// hand-rolled validators. No external dependency yet — if we add `zod` later,
// it goes here.

import type { ResourceBag, Resource } from '../game/resources/types.ts';
import { RESOURCES } from '../game/resources/types.ts';

export interface BuildingDef {
  name: string;
  // Gold-equivalent cost, used as a value heuristic (AI sort, refund math,
  // upgrade pricing). When `costBag` is absent this is also the actual
  // payment, treated as `{ gold: cost }`. When `costBag` is present that
  // bag is the actual payment and `cost` is informational only.
  cost: number;
  // Optional multi-resource cost. When defined, this is the bag the buy
  // move charges instead of `{ gold: cost }`. Mirrors the TechnologyDef
  // `costBag` pattern. The validator enforces only known resource keys
  // and non-negative integers.
  costBag?: Partial<ResourceBag>;
  benefit: string;
  note: string;
}

export interface UnitDef {
  name: string;
  // Gold-equivalent cost, used as a value heuristic (AI sort, refund math).
  // When `costBag` is absent this is also the actual recruit charge,
  // treated as `{ gold: cost }`. When `costBag` is present that bag is the
  // actual charge and `cost` is informational only — matches the
  // `BuildingDef` / `TechnologyDef` pattern.
  cost: number;
  // Optional multi-resource recruit cost. When defined, foreignRecruit
  // charges this bag (scaled by `count`) instead of `{ gold: cost }`. The
  // Domestic `unitCost` modifier (Forge: -1) only adjusts the gold
  // portion — non-gold inputs are not discountable.
  costBag?: Partial<ResourceBag>;
  initiative: number;
  attack: number;
  defense: number;
  altStats: string;
  requires: string;
  note: string;
}

export interface TechnologyDef {
  branch: string;
  name: string;
  order: string;
  cost: string;
  buildings: string;
  units: string;
  blueEvent: string;
  greenEvent: string;
  redEvent: string;
  goldEvent: string;
  // 08.6 — optional typed effect fields. The legacy string fields above
  // (`cost`, `blueEvent`, `greenEvent`, `redEvent`, `goldEvent`) hold the
  // human-authored text from the design doc; the typed fields below carry
  // the runtime-dispatchable shapes.
  //
  // Why these are optional: 08.6 doesn't migrate every entry in
  // technologies.json — content gets backfilled per-card as we author it.
  // Effect dispatch validates at runtime via the 08.2 dispatcher (any
  // unknown `kind` throws), so the loader stays permissive (`unknown[]`).
  //
  // - `costBag`: parsed-out resource cost as a Partial<ResourceBag>. The
  //   legacy `cost: string` slot stays for now; consumers prefer `costBag`
  //   when present.
  // - `onAcquireEffects`: dispatched once when the card is distributed
  //   into a hand by `scienceComplete` (05.3).
  // - `onPlayEffects`: dispatched when the holder explicitly plays the
  //   card via `<role>PlayTech` (08.6). Must be non-empty for those
  //   moves to accept the play.
  // - `passiveEffects`: aggregated by `techPassives(G, holder)` so the
  //   modifier pipeline can read them as long as the card is held.
  costBag?: Partial<ResourceBag>;
  onAcquireEffects?: unknown[];
  onPlayEffects?: unknown[];
  passiveEffects?: unknown[];
}

// --- helpers ---------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const requireString = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): string => {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(
      `${type}[${index}]: field "${key}" must be a string, got ${typeof v}`,
    );
  }
  return v;
};

const requireNumber = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): number => {
  const v = obj[key];
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be a number, got ${typeof v}`,
    );
  }
  return v;
};

const requireArray = (raw: unknown, type: string): unknown[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`${type}: expected an array, got ${typeof raw}`);
  }
  return raw;
};

const requireObject = (
  v: unknown,
  index: number,
  type: string,
): Record<string, unknown> => {
  if (!isPlainObject(v)) {
    throw new Error(`${type}[${index}]: expected an object, got ${typeof v}`);
  }
  return v;
};

// --- validators ------------------------------------------------------------

export const validateBuildings = (raw: unknown): BuildingDef[] => {
  const arr = requireArray(raw, 'BuildingDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'BuildingDef');
    const def: BuildingDef = {
      name: requireString(obj, 'name', i, 'BuildingDef'),
      cost: requireNumber(obj, 'cost', i, 'BuildingDef'),
      benefit: requireString(obj, 'benefit', i, 'BuildingDef'),
      note: requireString(obj, 'note', i, 'BuildingDef'),
    };
    const costBag = optionalCostBag(obj, 'costBag', i, 'BuildingDef');
    if (costBag !== undefined) def.costBag = costBag;
    return def;
  });
};

export const validateUnits = (raw: unknown): UnitDef[] => {
  const arr = requireArray(raw, 'UnitDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'UnitDef');
    const def: UnitDef = {
      name: requireString(obj, 'name', i, 'UnitDef'),
      cost: requireNumber(obj, 'cost', i, 'UnitDef'),
      initiative: requireNumber(obj, 'initiative', i, 'UnitDef'),
      attack: requireNumber(obj, 'attack', i, 'UnitDef'),
      defense: requireNumber(obj, 'defense', i, 'UnitDef'),
      altStats: requireString(obj, 'altStats', i, 'UnitDef'),
      requires: requireString(obj, 'requires', i, 'UnitDef'),
      note: requireString(obj, 'note', i, 'UnitDef'),
    };
    const costBag = optionalCostBag(obj, 'costBag', i, 'UnitDef');
    if (costBag !== undefined) def.costBag = costBag;
    return def;
  });
};

// Helper: pull an optional `Partial<ResourceBag>` out of `obj[key]`. Returns
// `undefined` when the field is absent; throws with the offending index/key
// when present-but-malformed. Centralized here because more than one
// validator (`TechnologyDef.costBag`, future cards) will want it.
const optionalCostBag = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): Partial<ResourceBag> | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!isPlainObject(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an object when present`,
    );
  }
  const out: Partial<ResourceBag> = {};
  for (const [resourceKey, value] of Object.entries(v)) {
    if (!(RESOURCES as ReadonlyArray<string>).includes(resourceKey)) {
      throw new Error(
        `${type}[${index}]: ${key} key "${resourceKey}" is not a known resource`,
      );
    }
    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
      throw new Error(
        `${type}[${index}]: ${key}.${resourceKey} must be a non-negative number, got ${String(value)}`,
      );
    }
    out[resourceKey as Resource] = value;
  }
  return out;
};

// Helper: pull an optional effects array out of `obj[key]`. `unknown[]` here
// — runtime dispatch validates per-entry. Throws when present-but-not-an-
// array.
const optionalEffectsArray = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): unknown[] | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an array when present`,
    );
  }
  // Copy so a downstream mutation can't reach back into the JSON module.
  return [...v];
};

export const validateTechnologies = (raw: unknown): TechnologyDef[] => {
  const arr = requireArray(raw, 'TechnologyDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'TechnologyDef');
    const tech: TechnologyDef = {
      branch: requireString(obj, 'branch', i, 'TechnologyDef'),
      name: requireString(obj, 'name', i, 'TechnologyDef'),
      order: requireString(obj, 'order', i, 'TechnologyDef'),
      cost: requireString(obj, 'cost', i, 'TechnologyDef'),
      buildings: requireString(obj, 'buildings', i, 'TechnologyDef'),
      units: requireString(obj, 'units', i, 'TechnologyDef'),
      blueEvent: requireString(obj, 'blueEvent', i, 'TechnologyDef'),
      greenEvent: requireString(obj, 'greenEvent', i, 'TechnologyDef'),
      redEvent: requireString(obj, 'redEvent', i, 'TechnologyDef'),
      goldEvent: requireString(obj, 'goldEvent', i, 'TechnologyDef'),
    };

    // Optional 08.6 fields. Only attach them to the returned object when
    // present, so `JSON.stringify(tech)` round-trips without spurious
    // `undefined` keys.
    const costBag = optionalCostBag(obj, 'costBag', i, 'TechnologyDef');
    if (costBag !== undefined) tech.costBag = costBag;
    const onAcq = optionalEffectsArray(obj, 'onAcquireEffects', i, 'TechnologyDef');
    if (onAcq !== undefined) tech.onAcquireEffects = onAcq;
    const onPlay = optionalEffectsArray(obj, 'onPlayEffects', i, 'TechnologyDef');
    if (onPlay !== undefined) tech.onPlayEffects = onPlay;
    const passive = optionalEffectsArray(obj, 'passiveEffects', i, 'TechnologyDef');
    if (passive !== undefined) tech.passiveEffects = passive;

    return tech;
  });
};
