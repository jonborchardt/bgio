// Shared types for the card-design preview page.
//
// Each variation is a self-contained module under ./variations/ that
// exports a `Renderer` component. The page wires variations into a tab
// strip; deleting a variation file removes that tab. Six sample cards
// are rendered across four canonical sizes.

import type { ComponentType } from 'react';
import type { BuildingDef, TechnologyDef, UnitDef } from '../../data/schema.ts';
import type { CanonicalScienceCardDef } from '../../data/scienceCards.ts';
import type { CardSize } from '../cards/sizes.ts';

export type SampleCardKind =
  | 'domesticBuilding'
  | 'domesticBuildingComplex'
  | 'placedVillage'
  | 'scienceCard'
  | 'scienceAdvanced'
  | 'foreignUnit'
  | 'army'
  | 'chiefTech'
  | 'chiefTechGrant';

export type SampleCard =
  | { kind: 'domesticBuilding'; def: BuildingDef }
  | { kind: 'domesticBuildingComplex'; def: BuildingDef }
  | { kind: 'placedVillage'; def: BuildingDef; count: number }
  | { kind: 'scienceCard'; def: CanonicalScienceCardDef }
  | { kind: 'scienceAdvanced'; def: CanonicalScienceCardDef }
  | { kind: 'foreignUnit'; def: UnitDef }
  | { kind: 'army'; def: UnitDef; count: number }
  | { kind: 'chiefTech'; def: TechnologyDef }
  | { kind: 'chiefTechGrant'; def: TechnologyDef };

export interface RendererProps {
  card: SampleCard;
  size: CardSize;
}

export type Renderer = ComponentType<RendererProps>;

export interface Variation {
  id: string;
  name: string;
  blurb: string;
  Renderer: Renderer;
}

// The 4 sizes we surface in the preview page (the canonical set has 5;
// `micro` is omitted because it's a one-line chip with no visual room
// for a design language to express itself).
export const PREVIEW_SIZES: ReadonlyArray<CardSize> = [
  'small',
  'normal',
  'detailed',
  'page',
];

export const PREVIEW_SIZE_LABELS: Record<CardSize, string> = {
  micro: 'Micro',
  small: 'Small',
  normal: 'Medium',
  detailed: 'Large',
  page: 'Details',
};

export const SAMPLE_LABELS: Record<SampleCardKind, string> = {
  domesticBuilding: 'Domestic — basic building',
  domesticBuildingComplex: 'Domestic — multi-cost building',
  placedVillage: 'Placed village (multi-copy)',
  scienceCard: 'Science — beginner cell',
  scienceAdvanced: 'Science — advanced cell',
  foreignUnit: 'Foreign — basic unit',
  army: 'Army (multi-unit, with reqs)',
  chiefTech: 'Chief — tech (resources only)',
  chiefTechGrant: 'Chief — tech (grants cards)',
};
