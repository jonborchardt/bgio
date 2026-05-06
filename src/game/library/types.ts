// Science Library SL 1.1 — `LibraryCard` union and type guard.
//
// Every card in the science library deck is a *tagged* version of an
// existing content card (building / unit / tech / event). The two new
// fields — `tier` (1/2/3) and `scienceColor` (gold/blue/green/red) —
// live on the original schemas as optional, and are required at runtime
// once the card is treated as a `LibraryCard`. This module owns the
// canonical union, the discriminator (`kind`), and the type guard
// loaders / tests use to filter tagged cards out of the raw content
// arrays.
//
// The discriminator (`kind`) reuses the same labels as
// `src/cards/registry.ts` (`'building' | 'unit' | 'tech' | 'event'`) so
// downstream consumers don't have to translate.

import type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
  LibraryTier,
  LibraryColor,
} from '../../data/schema.ts';
import type { EventCardDef } from '../../data/events.ts';

export type LibraryCardKind = 'building' | 'unit' | 'tech' | 'event';

// Each variant carries the original def under `def`, plus the two
// library-only fields hoisted to the top level so consumers don't have
// to keep re-narrowing through the def. The hoist is purely a
// convenience; the def itself still owns the same values.
export type LibraryCard =
  | {
      kind: 'building';
      tier: LibraryTier;
      scienceColor: LibraryColor;
      def: BuildingDef;
    }
  | {
      kind: 'unit';
      tier: LibraryTier;
      scienceColor: LibraryColor;
      def: UnitDef;
    }
  | {
      kind: 'tech';
      tier: LibraryTier;
      scienceColor: LibraryColor;
      def: TechnologyDef;
    }
  | {
      kind: 'event';
      tier: LibraryTier;
      scienceColor: LibraryColor;
      def: EventCardDef;
    };

// Predicate over either a raw def carrying optional `tier` /
// `scienceColor` (the JSON shape) or an already-constructed
// `LibraryCard` (the runtime shape). Returns true only when both
// fields are present and valid.
const isTaggedDef = (
  def: unknown,
): def is { tier: LibraryTier; scienceColor: LibraryColor } => {
  if (typeof def !== 'object' || def === null) return false;
  const d = def as { tier?: unknown; scienceColor?: unknown };
  if (d.tier !== 1 && d.tier !== 2 && d.tier !== 3) return false;
  if (
    d.scienceColor !== 'gold' &&
    d.scienceColor !== 'blue' &&
    d.scienceColor !== 'green' &&
    d.scienceColor !== 'red'
  ) {
    return false;
  }
  return true;
};

export const isLibraryCard = (x: unknown): x is LibraryCard => {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as {
    kind?: unknown;
    tier?: unknown;
    scienceColor?: unknown;
    def?: unknown;
  };
  if (
    c.kind !== 'building' &&
    c.kind !== 'unit' &&
    c.kind !== 'tech' &&
    c.kind !== 'event'
  ) {
    return false;
  }
  if (!isTaggedDef(x)) return false;
  if (typeof c.def !== 'object' || c.def === null) return false;
  return true;
};

// Helper: lift a tagged def into a `LibraryCard` of the matching kind.
// Returns `null` when the def is missing the library tags (caller can
// filter). Centralizes the hoist of `tier` / `scienceColor` from the
// def to the top level of the variant.
export const buildingToLibraryCard = (
  def: BuildingDef,
): LibraryCard | null => {
  if (def.tier === undefined || def.scienceColor === undefined) return null;
  return {
    kind: 'building',
    tier: def.tier,
    scienceColor: def.scienceColor,
    def,
  };
};

export const unitToLibraryCard = (def: UnitDef): LibraryCard | null => {
  if (def.tier === undefined || def.scienceColor === undefined) return null;
  return {
    kind: 'unit',
    tier: def.tier,
    scienceColor: def.scienceColor,
    def,
  };
};

export const techToLibraryCard = (
  def: TechnologyDef,
): LibraryCard | null => {
  if (def.tier === undefined || def.scienceColor === undefined) return null;
  return {
    kind: 'tech',
    tier: def.tier,
    scienceColor: def.scienceColor,
    def,
  };
};

export const eventToLibraryCard = (
  def: EventCardDef,
): LibraryCard | null => {
  if (def.tier === undefined || def.scienceColor === undefined) return null;
  return {
    kind: 'event',
    tier: def.tier,
    scienceColor: def.scienceColor,
    def,
  };
};
