// Live tile renderer — the React component used by the `liveTile`
// variation. Kept in its own file so `liveTile.ts` (the variation
// registry entry) doesn't mix component + non-component exports, which
// breaks Vite's React Fast Refresh.

import { Circle } from '../../mat/Circle.tsx';
import type { MatRendererProps } from '../types.ts';

export const LiveTileRenderer = ({ sample }: MatRendererProps) => (
  <Circle
    seat={sample.seat}
    mat={sample.mat}
    roles={sample.roles}
    active={sample.active}
    waitingFor={sample.waitingFor}
    bankView={sample.bankView}
  />
);
