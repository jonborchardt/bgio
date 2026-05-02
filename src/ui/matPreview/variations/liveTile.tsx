// Live tile — renders the production `Circle` (Dual Slots design)
// directly. This is what the running game ships. Other variations have
// been retired; this file exists so the preview page stays available
// as a tuning surface for the live design (sample states are still
// useful when iterating on tokens, glyphs, or layout in `Circle.tsx`).

import { Circle } from '../../mat/Circle.tsx';
import type { MatRendererProps, MatVariation } from '../types.ts';

const LiveTileRenderer = ({ sample }: MatRendererProps) => (
  <Circle
    seat={sample.seat}
    mat={sample.mat}
    roles={sample.roles}
    active={sample.active}
    waitingFor={sample.waitingFor}
    bankView={sample.bankView}
  />
);

export const liveTile: MatVariation = {
  id: 'live-tile',
  name: 'Live tile',
  blurb:
    'The in-game Circle (Dual Slots) tile rendered directly. This is the design the running game ships — every other variation has been retired.',
  Renderer: LiveTileRenderer,
};
