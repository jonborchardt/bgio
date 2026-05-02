// Variation registry. Each variation is a self-contained module under
// this folder; the registry is the only file that knows the full set.
//
// To delete a variation: remove its file, then drop its import + entry
// here. To add one: drop a file beside this one and append it.

import type { Variation } from '../types.ts';
import { baseline } from './baseline.tsx';
import { v1ModernMinimal } from './v1ModernMinimal.tsx';
import { v2Parchment } from './v2Parchment.tsx';
import { v3Heraldic } from './v3Heraldic.tsx';
import { v4CyberHud } from './v4CyberHud.tsx';
import { v5Storybook } from './v5Storybook.tsx';
import { v6FieldManual } from './v6FieldManual.tsx';
import { v7PaintedTile } from './v7PaintedTile.tsx';
import { v8Codex } from './v8Codex.tsx';
import { v9CodexByRole } from './v9CodexByRole.tsx';

export const VARIATIONS: ReadonlyArray<Variation> = [
  baseline,
  v1ModernMinimal,
  v2Parchment,
  v3Heraldic,
  v4CyberHud,
  v5Storybook,
  v6FieldManual,
  v7PaintedTile,
  v8Codex,
  v9CodexByRole,
];
