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
  // Defense redesign D15: maximum HP for this building when placed on the
  // domestic grid. Integer in [1, 4]; ties loosely to cost (shacks 1,
  // mid-tier 2, big buildings 3, fortifications 4) but **not** 1:1.
  // Read at runtime in 1.3 (building HP / repair); declared here in 1.1
  // so the loader and JSON are in sync with no behaviour change yet.
  maxHp: number;
}

// Defense redesign D18 — placement-bonus effects authored on a unit's card.
// The combat resolver (Phase 2) reads `UnitDef.placementBonus[]` at fire
// time and consults the building underneath the unit's tile. The same
// shape is reused by `SkillDef.effect` (D27) so a single applier can layer
// placement bonuses and taught skills on the same unit. `firstStrike` is
// the only flag-style effect; the rest carry an integer `amount`.
export type PlacementEffect =
  | { kind: 'strength'; amount: number }
  | { kind: 'range'; amount: number }
  | { kind: 'regen'; amount: number }
  | { kind: 'hp'; amount: number }
  | { kind: 'firstStrike' };

export interface PlacementBonus {
  // Matches `BuildingDef.name`. The schema validator checks the shape;
  // cross-table existence is asserted in tests so a typo in JSON surfaces
  // before the resolver tries to read it.
  buildingDefID: string;
  effect: PlacementEffect;
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
  // Defense redesign D9: total HP. Pure rename of the legacy `defense`
  // field — the old MTG-style "defense stat" doubled as HP in the battle
  // resolver, so 1.1 renames the field for clarity before 1.4 retires
  // the resolver entirely. Same numeric values, same call sites updated.
  hp: number;
  altStats: string;
  requires: string;
  // Optional typed list of prerequisite token names parsed out of the
  // free-text `requires` field. Each entry is a building or tech name as
  // it appears in BUILDINGS / TECHNOLOGIES. The relationships graph
  // (src/cards/relationships.ts) prefers this when present; otherwise it
  // falls back to a best-effort split of the `requires` string. Optional
  // so existing JSON entries don't need to be migrated wholesale.
  requiresList?: string[];
  note: string;
  // Defense redesign D9 — Chebyshev range (tiles a placed unit can defend
  // from its grid square). Default 1 for melee; ranged units bump this up.
  range: number;
  // Defense redesign D9 — HP regenerated per round, capped at hp at fire
  // time (Phase 2 enforces the cap). Default 0.
  regen: number;
  // Defense redesign D9 — first-strike flag. Default false. Phase 2's
  // resolver fires first-strike units before non-first-strike at the same
  // tile.
  firstStrike: boolean;
  // Defense redesign D18 — placement bonuses authored per unit. The
  // combat resolver reads this at fire time and matches `buildingDefID`
  // against the building underneath the unit. Default `[]` — most units
  // carry no placement bonus. The shape is opt-in in JSON; the loader
  // returns an empty array when absent so call sites can iterate
  // unconditionally.
  placementBonus: PlacementBonus[];
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
  // Optional typed unlock arrays parsed out of the free-text `buildings`
  // / `units` fields. Same opt-in pattern as `costBag` / `requiresList`:
  // the relationships graph uses these when present, otherwise it
  // best-effort splits the legacy text. Each name should match an entry
  // in BUILDINGS / UNITS; unknown names surface as graph warnings.
  unlocksBuildings?: string[];
  unlocksUnits?: string[];
  // Optional typed event-card linkage. Each entry is `{ color, name }`
  // referencing EVENT_CARDS. The legacy `blue/green/red/goldEvent`
  // strings stay as effect-text; this typed list says "for graph
  // purposes, these are the cards I link to." Optional.
  unlockEvents?: Array<{ color: 'blue' | 'green' | 'red' | 'gold'; name: string }>;
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

const requireBoolean = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): boolean => {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new Error(
      `${type}[${index}]: field "${key}" must be a boolean, got ${typeof v}`,
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
    const maxHp = requireNumber(obj, 'maxHp', i, 'BuildingDef');
    if (!Number.isInteger(maxHp) || maxHp < 1 || maxHp > 4) {
      throw new Error(
        `BuildingDef[${i}]: maxHp must be an integer in [1, 4], got ${String(maxHp)}`,
      );
    }
    const def: BuildingDef = {
      name: requireString(obj, 'name', i, 'BuildingDef'),
      cost: requireNumber(obj, 'cost', i, 'BuildingDef'),
      benefit: requireString(obj, 'benefit', i, 'BuildingDef'),
      note: requireString(obj, 'note', i, 'BuildingDef'),
      maxHp,
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
      hp: requireNumber(obj, 'hp', i, 'UnitDef'),
      altStats: requireString(obj, 'altStats', i, 'UnitDef'),
      requires: requireString(obj, 'requires', i, 'UnitDef'),
      note: requireString(obj, 'note', i, 'UnitDef'),
      // Defense redesign D9: range / regen / firstStrike. Required fields
      // — the JSON migration in 1.1 fills sane defaults across the table
      // (range 1, regen 0, firstStrike false) so the loader can stay
      // strict.
      range: requireNumber(obj, 'range', i, 'UnitDef'),
      regen: requireNumber(obj, 'regen', i, 'UnitDef'),
      firstStrike: requireBoolean(obj, 'firstStrike', i, 'UnitDef'),
      // Defense redesign D18: optional in JSON (most units have no
      // placement bonus). Loader normalizes to `[]` so call sites can
      // iterate without a null check.
      placementBonus: optionalPlacementBonusArray(
        obj,
        'placementBonus',
        i,
        'UnitDef',
      ) ?? [],
    };
    const costBag = optionalCostBag(obj, 'costBag', i, 'UnitDef');
    if (costBag !== undefined) def.costBag = costBag;
    const requiresList = optionalStringArray(obj, 'requiresList', i, 'UnitDef');
    if (requiresList !== undefined) def.requiresList = requiresList;
    return def;
  });
};

const optionalStringArray = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): string[] | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an array when present`,
    );
  }
  return v.map((entry, ei) => {
    if (typeof entry !== 'string') {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}] must be a string, got ${typeof entry}`,
      );
    }
    return entry;
  });
};

const EVENT_COLORS: ReadonlySet<'blue' | 'green' | 'red' | 'gold'> = new Set([
  'blue',
  'green',
  'red',
  'gold',
]);

const optionalUnlockEvents = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): Array<{ color: 'blue' | 'green' | 'red' | 'gold'; name: string }> | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an array when present`,
    );
  }
  return v.map((entry, ei) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}] must be an object`,
      );
    }
    const color = entry.color;
    const name = entry.name;
    if (typeof color !== 'string' || !EVENT_COLORS.has(color as 'blue' | 'green' | 'red' | 'gold')) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].color must be one of blue|green|red|gold`,
      );
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].name must be a non-empty string`,
      );
    }
    return { color: color as 'blue' | 'green' | 'red' | 'gold', name };
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

// Defense redesign D18 — optional `PlacementBonus[]` parser. Returns
// `undefined` when the JSON omits the key so the unit-loader can normalize
// to `[]` without round-tripping a spurious empty array. Throws on shape
// violations with the offending index/key.
const PLACEMENT_EFFECT_KINDS = new Set([
  'strength',
  'range',
  'regen',
  'hp',
  'firstStrike',
] as const);

const optionalPlacementBonusArray = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): PlacementBonus[] | undefined => {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an array when present`,
    );
  }
  return v.map((entry, ei): PlacementBonus => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}] must be an object`,
      );
    }
    const buildingDefID = entry.buildingDefID;
    if (typeof buildingDefID !== 'string' || buildingDefID.length === 0) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].buildingDefID must be a non-empty string`,
      );
    }
    const effect = entry.effect;
    if (!isPlainObject(effect)) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].effect must be an object`,
      );
    }
    const kind = effect.kind;
    if (
      typeof kind !== 'string' ||
      !(PLACEMENT_EFFECT_KINDS as ReadonlySet<string>).has(kind)
    ) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].effect.kind must be one of ` +
          `strength|range|regen|hp|firstStrike, got ${String(kind)}`,
      );
    }
    if (kind === 'firstStrike') {
      return { buildingDefID, effect: { kind: 'firstStrike' } };
    }
    const amount = effect.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}].effect.amount must be a finite number`,
      );
    }
    return {
      buildingDefID,
      effect: { kind: kind as 'strength' | 'range' | 'regen' | 'hp', amount },
    };
  });
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
    const unlocksB = optionalStringArray(obj, 'unlocksBuildings', i, 'TechnologyDef');
    if (unlocksB !== undefined) tech.unlocksBuildings = unlocksB;
    const unlocksU = optionalStringArray(obj, 'unlocksUnits', i, 'TechnologyDef');
    if (unlocksU !== undefined) tech.unlocksUnits = unlocksU;
    const unlockE = optionalUnlockEvents(obj, 'unlockEvents', i, 'TechnologyDef');
    if (unlockE !== undefined) tech.unlockEvents = unlockE;

    return tech;
  });
};
