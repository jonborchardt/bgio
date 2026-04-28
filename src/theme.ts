// Single source of truth for app-wide visual tokens.
//
// Intent: don't fight MUI. Spacing, typography variants, and breakpoints
// come straight from MUI's defaults — components keep using
// `theme.spacing()` (sx={{ p: 1.5 }}) and `<Typography variant="h4">`.
// What MUI does NOT model out of the box is the small domain-semantic
// palette this game needs (card states, active-player highlight, status
// colors). All of that lives here, gets attached to the MUI palette via
// module augmentation, and is type-safe inside any sx callback:
// `sx={{ color: t => t.palette.card.takenText }}`.
//
// Two layers:
//   1. `ramps` — the raw palette grouped by hue. Step numbers are
//      app-local — they reflect only the shades actually in use, not
//      a full Material scale. One hex lives in exactly one ramp slot;
//      tune the ramp, every semantic token that references it follows.
//   2. `colors` — semantic tokens (card, status, surface). Each is a
//      ramp reference, not a new hex.

import { createTheme } from '@mui/material/styles';

// ── ramps (raw palette grouped by hue) ────────────────────────────
// Step numbers are perceived luminance (Rec. 601) snapped to the
// nearest 50, with 0 = black and 1000 = white. This app's palette is
// tiny — a slate ramp for surfaces and text, plus one accent hue.

export const ramps = {
  slate: {
    50: '#f8fafc',
    400: '#94a3b8',
    600: '#475569',
    800: '#1e293b',
    900: '#0f172a',
  },
  sky: {
    400: '#38bdf8',
  },
} as const;

// ── semantic tokens (every value is a ramp reference) ────────────

export const colors = {
  // Card surfaces and text. The board's nine cards toggle between
  // `surface`/`text` (available) and `takenSurface`/`takenText`
  // (already picked).
  card: {
    surface: ramps.slate[800],
    text: ramps.slate[50],
    takenSurface: ramps.slate[900],
    takenText: ramps.slate[600],
  },

  // Status accents — `active` highlights the current player's score
  // tile and the in-progress status line; `muted` is for footer copy
  // and the score-tile labels.
  status: {
    active: ramps.sky[400],
    muted: ramps.slate[400],
  },

  // App-wide surface fallbacks. Used by CssBaseline (background.default)
  // and the centering wrapper in main.tsx.
  surface: {
    base: ramps.slate[900],
    text: ramps.slate[50],
  },
} as const;

declare module '@mui/material/styles' {
  interface Palette {
    card: typeof colors.card;
    status: typeof colors.status;
    appSurface: typeof colors.surface;
  }
  interface PaletteOptions {
    card?: typeof colors.card;
    status?: typeof colors.status;
    appSurface?: typeof colors.surface;
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: colors.surface.base,
      paper: colors.card.surface,
    },
    text: {
      primary: colors.surface.text,
      secondary: colors.status.muted,
    },
    primary: {
      main: colors.status.active,
    },
    card: colors.card,
    status: colors.status,
    appSurface: colors.surface,
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
});
