// TechCard — presentational view of a TechnologyDef. Delegates to the
// V9 shell, which renders four per-role panels (Chief / Science /
// Domestic / Foreign), each listing buildings / units / resources
// granted to that role.

import type { TechnologyDef } from '../../data/schema.ts';
import type { CardSize } from './sizes.ts';
import type { Role } from '../../game/types.ts';
import { idForTech } from '../../cards/registry.ts';
import { techDisplay } from './cardDisplay.ts';
import { V9CardShell } from './V9CardShell.tsx';

export interface TechCardProps {
  def: TechnologyDef;
  /** The role currently holding this tech in hand. Drives which role's
   *  section the small/normal sizes collapse to. */
  holderRole?: Role;
  size?: CardSize;
  cardId?: string;
}

export function TechCard({
  def,
  holderRole,
  size = 'detailed',
  cardId,
}: TechCardProps) {
  const id = cardId === undefined ? idForTech(def) : cardId || undefined;
  return (
    <V9CardShell
      display={techDisplay(def, holderRole)}
      size={size}
      cardId={id}
    />
  );
}

export default TechCard;
