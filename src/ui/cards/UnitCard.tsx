// UnitCard — presentational view of a UnitDef. Delegates to the V9
// shell; visual changes belong in `V9CardShell.tsx`.

import type { UnitDef } from '../../data/schema.ts';
import type { CardSize } from './sizes.ts';
import { idForUnit } from '../../cards/registry.ts';
import { unitDisplay } from './cardDisplay.ts';
import { V9CardShell } from './V9CardShell.tsx';

export interface UnitCardProps {
  def: UnitDef;
  count?: number;
  size?: CardSize;
  cardId?: string;
}

export function UnitCard({
  def,
  count,
  size = 'detailed',
  cardId,
}: UnitCardProps) {
  const id = cardId === undefined ? idForUnit(def) : cardId || undefined;
  return (
    <V9CardShell display={unitDisplay(def, count)} size={size} cardId={id} />
  );
}

export default UnitCard;
