// V6 is the only variation we keep — the previous v1–v5 explorations
// have been pruned. The registry shape is preserved so the modal can
// stay variation-agnostic if we add future layouts.

import type { ComponentType } from 'react';
import { Relationships6 } from './Relationships6.tsx';

export interface VariationProps {
  graph: import('../../../cards/relationships.ts').CardGraph;
  initialFocusId?: string | null;
}

export interface VariationDef {
  id: string;
  label: string;
  description: string;
  component: ComponentType<VariationProps>;
}

export const VARIATIONS: ReadonlyArray<VariationDef> = [
  {
    id: 'relationships6',
    label: 'Relationships',
    description: 'Focus card via grouped autocomplete; incoming-first detail',
    component: Relationships6,
  },
];
