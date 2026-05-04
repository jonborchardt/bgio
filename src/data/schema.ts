// Typed shapes for the raw JSON content under src/data/*.json, plus tiny
// hand-rolled validators. No external dependency yet — if we add `zod` later,
// it goes here.

import type { ResourceBag, Resource } from '../game/resources/types.ts';
import { RESOURCES } from '../game/resources/types.ts';

// Defense redesign 2.1 — Global Event Track card schema (D19, D20, D21).
//
// Phase 2 builds the track on top of this schema. Cards live in
// `src/data/trackCards.json`, are loaded by `src/data/trackCards.ts`, and
// surfaced via `TRACK_CARDS` from `src/data/index.ts`. Subsequent sub-phases
// add the runtime track state (2.2) and the resolve algorithm (2.3) — this
// sub-phase only ships the data path.
//
// Card kinds (D20):
//   - 'threat': the most common card. Walks toward center along a column
//     or row and resolves §3 of the spec.
//   - 'boon': dispatches a friendly effect through the existing event-effect
//     system. The dispatcher (Phase 2.3) casts `effect` to `EventEffect`
//     and validates per-entry, mirroring how `EventCardDef.effects` works
//     today.
//   - 'modifier': pushes a one-round rule bend onto the modifier stack. Same
//     `EventEffect`-typed shape as boons; the difference is purely how the
//     resolver routes it. `durationRounds` is currently always 1; the field
//     exists so a future "two-round storm" content card lands without a
//     schema migration.
//   - 'boss': the unique last card on the track. Three printed thresholds
//     (science / economy / military) plus a `baseAttacks` count and a
//     printed `attackPattern`. 2.7 implements the boss resolver.
export type Direction = 'N' | 'E' | 'S' | 'W';

const DIRECTIONS: ReadonlySet<Direction> = new Set(['N', 'E', 'S', 'W']);

export interface TrackCardBase {
  id: string;
  name: string;
  // 1..10 inclusive. Each phase pile is shuffled independently at setup
  // and the track is built by concatenating the shuffled piles in order.
  phase: number;
  description: string;
}

export interface ThreatCard extends TrackCardBase {
  kind: 'threat';
  direction: Direction;
  // Signed offset from center on the perpendicular axis. Threats from N or
  // S walk down a column at offset (x = offset); threats from E or W walk
  // along a row at offset (y = offset). Integer.
  offset: number;
  // Both HP (units chip it down) and damage (leftover hits the building,
  // then continues toward center). D7. >= 1.
  strength: number;
  // Optional bank reward when killed. Same shape as elsewhere — a partial
  // resource bag.
  reward?: Partial<ResourceBag>;
  // Free-text matchup tags read by the resolver (e.g. "Cavalry", "Flier")
  // — D10. Optional; absent means the card has no matchup keywords.
  modifiers?: string[];
}

export interface ThreatPattern {
  direction: Direction;
  offset: number;
  strength: number;
}

// Boon and Modifier effects reuse the existing `EventEffect` taxonomy (08.2,
// `src/game/events/effects.ts`). The loader keeps `effect` as `unknown` —
// the dispatcher in Phase 2.3 casts and validates per-entry, mirroring how
// `EventCardDef.effects` is loaded as `unknown[]` today.
export interface BoonCard extends TrackCardBase {
  kind: 'boon';
  effect: unknown;
}

export interface ModifierCard extends TrackCardBase {
  kind: 'modifier';
  // Typically 1; the field exists so a future multi-round modifier card
  // can land without a schema migration. Integer >= 1.
  durationRounds: number;
  effect: unknown;
}

export interface BossThresholds {
  // Completed science card count.
  science: number;
  // Bank gold.
  economy: number;
  // Sum of unit.strength on grid.
  military: number;
}

export interface BossCard extends TrackCardBase {
  kind: 'boss';
  thresholds: BossThresholds;
  // Attacks made if no thresholds are met. Each met threshold subtracts 1.
  // Integer >= 1. (Spec §5: each *unmet* threshold adds 1, so authoring as
  // baseAttacks and reading downward is equivalent for the V1 boss.)
  baseAttacks: number;
  // Sequence of strengths + directions for each attack. The resolver in
  // 2.7 walks this list as the boss fires; entries beyond the boss's
  // computed attack count are ignored.
  attackPattern: ThreatPattern[];
}

export type TrackCardDef =
  | ThreatCard
  | BoonCard
  | ModifierCard
  | BossCard;

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

// --- track cards (defense redesign 2.1) -----------------------------------

const requireDirection = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): Direction => {
  const v = obj[key];
  if (typeof v !== 'string' || !DIRECTIONS.has(v as Direction)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be one of N|E|S|W, got ${String(v)}`,
    );
  }
  return v as Direction;
};

const requireInteger = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): number => {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be an integer, got ${String(v)}`,
    );
  }
  return v;
};

const optionalRewardBag = (
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

const optionalModifiersList = (
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
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(
        `${type}[${index}]: ${key}[${ei}] must be a non-empty string, got ${String(entry)}`,
      );
    }
    return entry;
  });
};

const validateAttackPattern = (
  raw: unknown,
  index: number,
  type: string,
): ThreatPattern[] => {
  if (!Array.isArray(raw)) {
    throw new Error(
      `${type}[${index}]: field "attackPattern" must be an array, got ${typeof raw}`,
    );
  }
  return raw.map((entry, ei): ThreatPattern => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `${type}[${index}]: attackPattern[${ei}] must be an object, got ${typeof entry}`,
      );
    }
    const direction = entry.direction;
    if (typeof direction !== 'string' || !DIRECTIONS.has(direction as Direction)) {
      throw new Error(
        `${type}[${index}]: attackPattern[${ei}].direction must be one of N|E|S|W, got ${String(direction)}`,
      );
    }
    const offset = entry.offset;
    if (typeof offset !== 'number' || !Number.isInteger(offset)) {
      throw new Error(
        `${type}[${index}]: attackPattern[${ei}].offset must be an integer, got ${String(offset)}`,
      );
    }
    const strength = entry.strength;
    if (typeof strength !== 'number' || !Number.isInteger(strength) || strength < 1) {
      throw new Error(
        `${type}[${index}]: attackPattern[${ei}].strength must be an integer >= 1, got ${String(strength)}`,
      );
    }
    return {
      direction: direction as Direction,
      offset,
      strength,
    };
  });
};

// Validates the track-card list. Per-card checks live here; cross-card
// invariants (one boss in phase 10, all phases 1..10 covered, unique IDs)
// are enforced by the loader (`src/data/trackCards.ts`) so the tests can
// assert each invariant independently.
export const validateTrackCards = (raw: unknown): TrackCardDef[] => {
  const arr = requireArray(raw, 'TrackCardDef');
  return arr.map((entry, i): TrackCardDef => {
    const obj = requireObject(entry, i, 'TrackCardDef');
    const id = requireString(obj, 'id', i, 'TrackCardDef');
    if (id.length === 0) {
      throw new Error(`TrackCardDef[${i}]: field "id" must be non-empty`);
    }
    const name = requireString(obj, 'name', i, 'TrackCardDef');
    const description = requireString(obj, 'description', i, 'TrackCardDef');
    const phase = requireInteger(obj, 'phase', i, 'TrackCardDef');
    if (phase < 1 || phase > 10) {
      throw new Error(
        `TrackCardDef[${i}]: phase must be in [1, 10], got ${phase}`,
      );
    }
    const kind = obj.kind;
    if (typeof kind !== 'string') {
      throw new Error(
        `TrackCardDef[${i}]: field "kind" must be a string, got ${typeof kind}`,
      );
    }
    if (kind === 'threat') {
      const direction = requireDirection(obj, 'direction', i, 'TrackCardDef');
      const offset = requireInteger(obj, 'offset', i, 'TrackCardDef');
      const strength = requireInteger(obj, 'strength', i, 'TrackCardDef');
      if (strength < 1) {
        throw new Error(
          `TrackCardDef[${i}]: threat strength must be >= 1, got ${strength}`,
        );
      }
      const card: ThreatCard = {
        kind: 'threat',
        id,
        name,
        phase,
        description,
        direction,
        offset,
        strength,
      };
      const reward = optionalRewardBag(obj, 'reward', i, 'TrackCardDef');
      if (reward !== undefined) card.reward = reward;
      const modifiers = optionalModifiersList(obj, 'modifiers', i, 'TrackCardDef');
      if (modifiers !== undefined) card.modifiers = modifiers;
      return card;
    }
    if (kind === 'boon') {
      const effect = obj.effect;
      if (effect === undefined) {
        throw new Error(
          `TrackCardDef[${i}]: boon card requires an "effect" field`,
        );
      }
      return { kind: 'boon', id, name, phase, description, effect };
    }
    if (kind === 'modifier') {
      const durationRounds = requireInteger(
        obj,
        'durationRounds',
        i,
        'TrackCardDef',
      );
      if (durationRounds < 1) {
        throw new Error(
          `TrackCardDef[${i}]: modifier durationRounds must be >= 1, got ${durationRounds}`,
        );
      }
      const effect = obj.effect;
      if (effect === undefined) {
        throw new Error(
          `TrackCardDef[${i}]: modifier card requires an "effect" field`,
        );
      }
      return {
        kind: 'modifier',
        id,
        name,
        phase,
        description,
        durationRounds,
        effect,
      };
    }
    if (kind === 'boss') {
      const baseAttacks = requireInteger(obj, 'baseAttacks', i, 'TrackCardDef');
      if (baseAttacks < 1) {
        throw new Error(
          `TrackCardDef[${i}]: boss baseAttacks must be >= 1, got ${baseAttacks}`,
        );
      }
      const thresholdsRaw = obj.thresholds;
      if (!isPlainObject(thresholdsRaw)) {
        throw new Error(
          `TrackCardDef[${i}]: boss requires a "thresholds" object`,
        );
      }
      const science = requireInteger(thresholdsRaw, 'science', i, 'TrackCardDef.thresholds');
      const economy = requireInteger(thresholdsRaw, 'economy', i, 'TrackCardDef.thresholds');
      const military = requireInteger(thresholdsRaw, 'military', i, 'TrackCardDef.thresholds');
      if (science < 0 || economy < 0 || military < 0) {
        throw new Error(
          `TrackCardDef[${i}]: boss thresholds must be non-negative integers`,
        );
      }
      const attackPattern = validateAttackPattern(
        obj.attackPattern,
        i,
        'TrackCardDef',
      );
      return {
        kind: 'boss',
        id,
        name,
        phase,
        description,
        baseAttacks,
        thresholds: { science, economy, military },
        attackPattern,
      };
    }
    throw new Error(
      `TrackCardDef[${i}]: unknown kind "${String(kind)}" — expected threat|boon|modifier|boss`,
    );
  });
};
