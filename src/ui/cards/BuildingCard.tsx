// BuildingCard — presentational view of a BuildingDef. Delegates to the
// V9 shell; visual changes belong in `V9CardShell.tsx`. Default size is
// `detailed` (large) — the form most game UI now renders. Smaller sizes
// stay supported for the relationships modal + graph.

import type { BuildingDef } from '../../data/schema.ts';
import type { CardSize } from './sizes.ts';
import { idForBuilding } from '../../cards/registry.ts';
import { buildingDisplay } from './cardDisplay.ts';
import { V9CardShell } from './V9CardShell.tsx';

export interface BuildingCardProps {
  def: BuildingDef;
  count?: number;
  size?: CardSize;
  /** Override the auto-derived card id (`building:<name>`). Pass an
   *  empty string to suppress the `?` button entirely. */
  cardId?: string;
  /** defIDs of the buildings currently neighbouring this one on the
   *  village grid. When present, the adjacency block on the card paints
   *  each rule as `✓` (active) or `·` (latent). Omit for in-hand /
   *  preview cards — those render every rule as inactive guidance. */
  activeNeighbors?: ReadonlySet<string>;
}

export function BuildingCard({
  def,
  count,
  size = 'detailed',
  cardId,
  activeNeighbors,
}: BuildingCardProps) {
  const id = cardId === undefined ? idForBuilding(def) : cardId || undefined;
  return (
    <V9CardShell
      display={buildingDisplay(def, count, activeNeighbors)}
      size={size}
      cardId={id}
    />
  );
}

export default BuildingCard;
