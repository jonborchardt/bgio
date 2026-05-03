// Variation registry. After the workshop pass landed on Dual Slots as
// the production design, the four alternatives were retired and the
// remaining "Live tile" entry just imports the production `Circle`
// directly — same pattern as `cardPreview/variations/liveShell`.

import type { MatVariation } from '../types.ts';
import { liveTile } from './liveTile.ts';

export const VARIATIONS: ReadonlyArray<MatVariation> = [liveTile];
