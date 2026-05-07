// Live shell — renders the in-game V9CardShell directly.
//
// This is the design actually used in the running game (and the only one
// that has to stay in sync with real card data). Other historical
// variations have been removed; this file exists so the preview page can
// still show every sample card across every preview size against the
// shipping shell.

import type { Variation } from '../types.ts';
import { LiveShellRenderer } from './LiveShellRenderer.tsx';

export const liveShell: Variation = {
  id: 'live-shell',
  name: 'Live shell',
  blurb:
    'The in-game V9CardShell rendered directly. This is the design the running game ships — every other variation has been retired.',
  Renderer: LiveShellRenderer,
};
