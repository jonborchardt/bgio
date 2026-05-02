// Variation 0 — baseline. Uses the existing card components verbatim so
// the user can compare every other variation against the current look.

import { BuildingCard } from '../../cards/BuildingCard.tsx';
import { ScienceCard } from '../../cards/ScienceCard.tsx';
import { TechCard } from '../../cards/TechCard.tsx';
import { UnitCard } from '../../cards/UnitCard.tsx';
import type { Renderer, Variation } from '../types.ts';

const BaselineRenderer: Renderer = ({ card, size }) => {
  switch (card.kind) {
    case 'domesticBuilding':
    case 'domesticBuildingComplex':
      return <BuildingCard def={card.def} size={size} cardId="" />;
    case 'placedVillage':
      return (
        <BuildingCard
          def={card.def}
          count={card.count}
          size={size}
          cardId=""
        />
      );
    case 'scienceCard':
    case 'scienceAdvanced':
      return <ScienceCard def={card.def} size={size} cardId="" />;
    case 'foreignUnit':
      return <UnitCard def={card.def} size={size} cardId="" />;
    case 'army':
      return (
        <UnitCard def={card.def} count={card.count} size={size} cardId="" />
      );
    case 'chiefTech':
    case 'chiefTechGrant':
      return (
        <TechCard def={card.def} holderRole="chief" size={size} cardId="" />
      );
  }
};

export const baseline: Variation = {
  id: 'baseline',
  name: 'Baseline',
  blurb:
    'The current cards, unchanged. Use this as the comparison reference.',
  Renderer: BaselineRenderer,
};
