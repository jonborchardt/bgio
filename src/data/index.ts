// Typed barrel for the active card deck. Validators run at module load —
// if the configured deck's JSON goes out of shape, importing this file
// throws synchronously (intentional crash-early). Logic everywhere else
// imports from here, never from the raw JSON files directly.
//
// The deck source is selected by `./deckSelection.ts` (config-driven; see
// `card-decks/deck.config.json` and the `VITE_DECK` env var).

import { pickFromGlob } from './deckSelection.ts';
import {
  validateBuildings,
  validateUnits,
  validateTechnologies,
} from './schema.ts';

// Eagerly load every deck's JSON so the bundle ships them all and the
// resolver picks one at module load. Vite resolves these globs at build
// time — adding a new deck folder under `card-decks/` is enough to make
// it pickable; no loader change required.
const BUILDINGS_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/buildings.json',
  { eager: true, import: 'default' },
);
const UNITS_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/units.json',
  { eager: true, import: 'default' },
);
const TECHNOLOGIES_BY_DECK = import.meta.glob<unknown>(
  '/card-decks/*/technologies.json',
  { eager: true, import: 'default' },
);

const buildingsRaw = pickFromGlob(BUILDINGS_BY_DECK, 'buildings.json');
const unitsRaw = pickFromGlob(UNITS_BY_DECK, 'units.json');
const technologiesRaw = pickFromGlob(TECHNOLOGIES_BY_DECK, 'technologies.json');
import type { BuildingDef, UnitDef, TechnologyDef } from './schema.ts';

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
} from './schema.ts';

export { TRACK_CARDS } from './trackCards.ts';
// Issue 015 — these were referenced from `events.ts` / `adjacency.ts`
// directly by their three consumers (cards/registry.ts,
// roles/domestic/adjacency.ts, cards/relationships.ts). Re-exporting
// here lets every call site go through the data barrel, matching
// CLAUDE.md's "imports always go through the loaders" rule.
export { EVENT_CARDS } from './events.ts';
export type { EventCardDef, EventColor } from './events.ts';
export { ADJACENCY_RULES } from './adjacency.ts';
export type { AdjacencyRuleDef } from './adjacency.ts';

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
 * Single source of truth for "what does buying one of this unit cost?"
 * Mirrors `buildingCost`: returns `def.costBag` when present, else
 * `{ gold: def.cost }`. Domestic-side recruit-cost modifiers were retired
 * in 1.4 (D14 / D18); per-unit placement bonuses live on the unit card
 * itself in Phase 2.
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
//
// Issue 013 — defense redesign 1.4 retired the `'unit maintenance'` and
// `'defense'` verbs (D14 / D18). The list now reflects only the verbs the
// parser still resolves; reintroducing either token requires re-wiring
// the resolver first, so failing fast at the type level is the win here.
//
// Raw-material verbs (wood / stone / steel / horse) were added so the
// Library cost ladders (blue → wood, green → wood / stone, red → steel,
// red → horse) have building-driven production paths and aren't
// dependent on a single random track-boon flip per match.
export const BENEFIT_TOKENS = [
  'food',
  'production',
  'science',
  'gold',
  'wood',
  'stone',
  'steel',
  'horse',
  'attack',
  'happiness',
] as const;

export type BenefitToken = (typeof BENEFIT_TOKENS)[number];
