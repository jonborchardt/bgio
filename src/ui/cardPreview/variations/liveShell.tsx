// Live shell — renders the in-game V9CardShell directly.
//
// This is the design actually used in the running game (and the only one
// that has to stay in sync with real card data). Other historical
// variations have been removed; this file exists so the preview page can
// still show every sample card across every preview size against the
// shipping shell.

import type { Renderer, RendererProps, Variation } from '../types.ts';
import {
  buildingDisplay,
  scienceDisplay,
  techDisplay,
  unitDisplay,
} from '../../cards/cardDisplay.ts';
import { V9CardShell } from '../../cards/V9CardShell.tsx';

const LiveShellRenderer: Renderer = ({ card, size }: RendererProps) => {
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

export const liveShell: Variation = {
  id: 'live-shell',
  name: 'Live shell',
  blurb:
    'The in-game V9CardShell rendered directly. This is the design the running game ships — every other variation has been retired.',
  Renderer: LiveShellRenderer,
};
