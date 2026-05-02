// Generic dispatcher: takes any AnyCardEntry from the registry and
// renders the matching canonical card component at the requested size.
//
// This is the seam the relationships modal, list views, and React Flow
// nodes use so they don't switch on `entry.kind` themselves. Adding a
// new card kind only requires adding a case here.

import type { AnyCardEntry } from '../../cards/registry.ts';
import { BuildingCard } from './BuildingCard.tsx';
import { UnitCard } from './UnitCard.tsx';
import { TechCard } from './TechCard.tsx';
import { ScienceCard } from './ScienceCard.tsx';
import { WanderCard } from './WanderCard.tsx';
import { EventCard } from './EventCard.tsx';
import { TradeCard } from './TradeCard.tsx';
import { BattleCard } from './BattleCard.tsx';
import type { CardSize } from './sizes.ts';

export interface AnyCardProps {
  entry: AnyCardEntry;
  size?: CardSize;
}

export function AnyCard({ entry, size = 'normal' }: AnyCardProps) {
  switch (entry.kind) {
    case 'building':
      return <BuildingCard def={entry.def} size={size} />;
    case 'unit':
      return <UnitCard def={entry.def} size={size} />;
    case 'tech':
      return <TechCard def={entry.def} size={size} />;
    case 'science':
      return <ScienceCard def={entry.def} size={size} />;
    case 'wander':
      return <WanderCard def={entry.def} size={size} />;
    case 'event':
      return <EventCard def={entry.def} size={size} />;
    case 'trade':
      return <TradeCard def={entry.def} size={size} />;
    case 'battle':
      return <BattleCard def={entry.def} size={size} />;
  }
}

export default AnyCard;
