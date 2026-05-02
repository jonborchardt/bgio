// ScienceCard — generic presentational view of a canonical science card.
// Delegates to the V9 shell. NOTE: the Science role's interactive panel
// card lives at `src/ui/science/ScienceCard.tsx`; this is the readonly
// view used by the relationships modal, graph nodes, and any other
// "show me a science card" surface.

import type { CanonicalScienceCardDef } from '../../data/scienceCards.ts';
import type { CardSize } from './sizes.ts';
import { idForScience } from '../../cards/registry.ts';
import { scienceDisplay } from './cardDisplay.ts';
import { V9CardShell } from './V9CardShell.tsx';

export interface ScienceCardProps {
  def: CanonicalScienceCardDef;
  size?: CardSize;
  cardId?: string;
}

export function ScienceCard({
  def,
  size = 'detailed',
  cardId,
}: ScienceCardProps) {
  const id = cardId === undefined ? idForScience(def) : cardId || undefined;
  return (
    <V9CardShell
      display={scienceDisplay(def)}
      size={size}
      cardId={id}
    />
  );
}

export default ScienceCard;
