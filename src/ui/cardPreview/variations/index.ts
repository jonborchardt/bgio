// Variation registry. Each variation is a self-contained module under
// this folder; the registry is the only file that knows the full set.
//
// To delete a variation: remove its file, then drop its import + entry
// here. To add one: drop a file beside this one and append it.

import type { Variation } from '../types.ts';
import { liveShell } from './liveShell.tsx';

export const VARIATIONS: ReadonlyArray<Variation> = [
  liveShell,
];
