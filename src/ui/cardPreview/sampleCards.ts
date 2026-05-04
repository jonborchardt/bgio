// Six sample card fixtures used by every variation. Pulled from real
// content (BUILDINGS / UNITS / TECHNOLOGIES / SCIENCE_CANONICAL_CARDS) so
// the previews use shapes the variations will actually have to render in
// production — not synthetic placeholders.

import { BUILDINGS, UNITS, TECHNOLOGIES } from '../../data/index.ts';
import { SCIENCE_CANONICAL_CARDS } from '../../data/scienceCards.ts';
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

// Pick a canonical science card by coordinates. Falls back to the first
// canonical card if the chosen cell is somehow missing (defensive).
const pickScience = (
  color: 'red' | 'gold' | 'green' | 'blue',
  tier: 'beginner' | 'intermediate' | 'advanced',
  level: 0 | 1 | 2 | 3,
) => {
  const preferred = SCIENCE_CANONICAL_CARDS.find(
    (c) => c.color === color && c.tier === tier && c.level === level,
  );
  if (preferred) return preferred;
  // Same tier any-color fallback so the "advanced" sample stays advanced.
  const tierMatch = SCIENCE_CANONICAL_CARDS.find((c) => c.tier === tier);
  return tierMatch ?? SCIENCE_CANONICAL_CARDS[0];
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
  scienceCard: {
    kind: 'scienceCard',
    def: pickScience('green', 'beginner', 0),
  },
  scienceAdvanced: {
    kind: 'scienceAdvanced',
    def: pickScience('red', 'advanced', 3),
  },
  defenseUnit: { kind: 'defenseUnit', def: findUnit('Scout') },
  army: { kind: 'army', def: findUnit('Spearman'), count: 3 },
  // Resource-only chief tech: every event line is a small bag of
  // resources. Useful baseline for "what does a minimal tech look like".
  chiefTech: { kind: 'chiefTech', def: findTech('Loot store') },
  // Card-granting chief tech: unlocks both buildings AND units, and
  // its event lines mix resources with combat modifiers. The richest
  // tech shape — variations need to render `Grants:` prominently.
  chiefTechGrant: { kind: 'chiefTechGrant', def: findTech('Stick fighting') },
};

export const SAMPLE_KINDS: ReadonlyArray<SampleCardKind> = [
  'domesticBuilding',
  'domesticBuildingComplex',
  'placedVillage',
  'scienceCard',
  'scienceAdvanced',
  'defenseUnit',
  'army',
  'chiefTech',
  'chiefTechGrant',
];
