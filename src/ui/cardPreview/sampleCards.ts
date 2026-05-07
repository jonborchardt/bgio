// Sample card fixtures used by every variation. Pulled from real
// content (BUILDINGS / UNITS / TECHNOLOGIES) so the previews use shapes
// the variations will actually have to render in production — not
// synthetic placeholders.

import { BUILDINGS, UNITS, TECHNOLOGIES } from '../../data/index.ts';
import type { SampleCard, SampleCardKind } from './types.ts';

const findBuilding = (name: string) => {
  const b = BUILDINGS.find((x) => x.name === name);
  if (!b) throw new Error(`Sample building not found: ${name}`);
  return b;
};

const findUnit = (name: string) => {
  const u = UNITS.find((x) => x.name === name);
  if (!u) throw new Error(`Sample unit not found: ${name}`);
  return u;
};

const findTech = (name: string) => {
  const t = TECHNOLOGIES.find((x) => x.name === name);
  if (!t) throw new Error(`Sample tech not found: ${name}`);
  return t;
};

export const SAMPLE_CARDS: Record<SampleCardKind, SampleCard> = {
  domesticBuilding: { kind: 'domesticBuilding', def: findBuilding('Granary') },
  domesticBuildingComplex: {
    kind: 'domesticBuildingComplex',
    def: findBuilding('Smithy'),
  },
  placedVillage: {
    kind: 'placedVillage',
    def: findBuilding('Smokehouse'),
    count: 2,
  },
  defenseUnit: { kind: 'defenseUnit', def: findUnit('Scout') },
  army: { kind: 'army', def: findUnit('Spearman'), count: 3 },
  chiefTech: { kind: 'chiefTech', def: findTech('Loot store') },
  chiefTechGrant: { kind: 'chiefTechGrant', def: findTech('Stick fighting') },
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
