// Live shell renderer — the React component used by the `liveShell`
// variation. Kept in its own file so `liveShell.ts` (the variation
// registry entry) doesn't mix component + non-component exports, which
// breaks Vite's React Fast Refresh.

import type { Renderer, RendererProps } from '../types.ts';
import {
  buildingDisplay,
  scienceDisplay,
  techDisplay,
  unitDisplay,
} from '../../cards/cardDisplay.ts';
import { V9CardShell } from '../../cards/V9CardShell.tsx';

export const LiveShellRenderer: Renderer = ({ card, size }: RendererProps) => {
  switch (card.kind) {
    case 'domesticBuilding':
    case 'domesticBuildingComplex':
      return <V9CardShell display={buildingDisplay(card.def)} size={size} />;
    case 'placedVillage':
      return (
        <V9CardShell
          display={buildingDisplay(card.def, card.count)}
          size={size}
        />
      );
    case 'scienceCard':
    case 'scienceAdvanced':
      return <V9CardShell display={scienceDisplay(card.def)} size={size} />;
    case 'foreignUnit':
      return <V9CardShell display={unitDisplay(card.def)} size={size} />;
    case 'army':
      return (
        <V9CardShell display={unitDisplay(card.def, card.count)} size={size} />
      );
    case 'chiefTech':
    case 'chiefTechGrant':
      return <V9CardShell display={techDisplay(card.def)} size={size} />;
  }
};
