// Sample card fixtures used by every variation. Pulled from real
// content (BUILDINGS / UNITS / TECHNOLOGIES) so the previews use shapes
// the variations will actually have to render in production — not
// synthetic placeholders.
//
// Each lookup is resilient: try a list of preferred names from the
// current and historical decks, then fall back to the first card
// matching a shape predicate, then the first card overall. Never
// throw — these are dev-only previews and the `#cards` page isn't
// worth crashing the whole app for.

import { BUILDINGS, UNITS, TECHNOLOGIES } from '../../data/index.ts';
import type {
  BuildingDef,
  TechnologyDef,
  UnitDef,
} from '../../data/index.ts';
import type { SampleCard, SampleCardKind } from './types.ts';

const pick = <T extends { name: string }>(
  pool: ReadonlyArray<T>,
  preferred: ReadonlyArray<string>,
  shape?: (x: T) => boolean,
): T => {
  for (const name of preferred) {
    const hit = pool.find((x) => x.name === name);
    if (hit) return hit;
  }
  if (shape) {
    const shaped = pool.find(shape);
    if (shaped) return shaped;
  }
  return pool[0];
};

const techHasGrants = (t: TechnologyDef) =>
  Boolean((t.buildings && t.buildings.trim()) || (t.units && t.units.trim()));
const techIsResourceOnly = (t: TechnologyDef) => !techHasGrants(t);

const granary: BuildingDef = pick(BUILDINGS, ['Granary']);
const smithy: BuildingDef = pick(BUILDINGS, ['Smithy']);
const smokehouse: BuildingDef = pick(BUILDINGS, ['Smokehouse']);
const scout: UnitDef = pick(UNITS, ['Scout']);
const spearman: UnitDef = pick(UNITS, ['Spearman', 'Brute']);
const techResourceOnly: TechnologyDef = pick(
  TECHNOLOGIES,
  ['Loot store', 'Loot Corpse', 'Tribute', 'Diplomacy'],
  techIsResourceOnly,
);
const techWithGrants: TechnologyDef = pick(
  TECHNOLOGIES,
  ['Stick fighting', 'Foraging', 'Bartering'],
  techHasGrants,
);

export const SAMPLE_CARDS: Record<SampleCardKind, SampleCard> = {
  domesticBuilding: { kind: 'domesticBuilding', def: granary },
  domesticBuildingComplex: { kind: 'domesticBuildingComplex', def: smithy },
  placedVillage: { kind: 'placedVillage', def: smokehouse, count: 2 },
  defenseUnit: { kind: 'defenseUnit', def: scout },
  army: { kind: 'army', def: spearman, count: 3 },
  chiefTech: { kind: 'chiefTech', def: techResourceOnly },
  chiefTechGrant: { kind: 'chiefTechGrant', def: techWithGrants },
};

export const SAMPLE_KINDS: ReadonlyArray<SampleCardKind> = [
  'domesticBuilding',
  'domesticBuildingComplex',
  'placedVillage',
  'defenseUnit',
  'army',
  'chiefTech',
  'chiefTechGrant',
];
