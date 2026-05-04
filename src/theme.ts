// Single source of truth for app-wide visual tokens.
//
// Intent: don't fight MUI. Spacing, typography variants, and breakpoints
// come straight from MUI's defaults — components keep using
// `theme.spacing()` (sx={{ p: 1.5 }}) and `<Typography variant="h4">`.
// What MUI does NOT model out of the box is the small domain-semantic
// palette this game needs (card states, active-player highlight, status
// colors, plus the per-resource / per-role / per-tier / per-event-color
// tokens added in 09.4). All of that lives here, gets attached to the
// MUI palette via module augmentation, and is type-safe inside any sx
// callback: `sx={{ color: t => t.palette.card.takenText }}` or
// `sx={{ bgcolor: t => t.palette.resource.gold.main }}`.
//
// Two layers:
//   1. `ramps` — the raw palette grouped by hue. Step numbers are
//      app-local — they reflect only the shades actually in use, not
//      a full Material scale. One hex lives in exactly one ramp slot;
//      tune the ramp, every semantic token that references it follows.
//   2. `colors` / per-domain groups (`resource`, `role`, `tier`,
//      `eventColor`) — semantic tokens that resolve to ramp references.

import { createTheme } from '@mui/material/styles';
import type { PaletteColor } from '@mui/material/styles';
import { RESOURCES } from './game/resources/types.ts';
import type { Resource } from './game/resources/types.ts';
import type { Role } from './game/types.ts';
import type { EventColor } from './data/events.ts';

// ── ramps (raw palette grouped by hue) ────────────────────────────
// Step numbers follow the existing 50 / 300 / 500 / 700 / 800 / 900
// convention (perceived luminance, Rec. 601, snapped to nearest 50;
// 0 = black, 1000 = white). Only the shades the app actually uses
// live in each ramp — this is not a full Material scale.

export const ramps = {
  slate: {
    50: '#f8fafc',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  sky: {
    400: '#38bdf8',
  },
  // Resource-group ramps (added 09.4).
  yellow: {
    50: '#fefce8',
    300: '#fde047',
    500: '#eab308',
    700: '#a16207',
  },
  brown: {
    50: '#f5ede4',
    300: '#c9a78a',
    500: '#8b5a2b',
    700: '#5a3a1c',
  },
  grey: {
    50: '#f3f4f6',
    300: '#d1d5db',
    500: '#6b7280',
    700: '#374151',
  },
  orange: {
    50: '#fff7ed',
    300: '#fdba74',
    500: '#f97316',
    700: '#c2410c',
  },
  greenFood: {
    50: '#ecfdf5',
    300: '#6ee7b7',
    500: '#10b981',
    700: '#047857',
  },
  // Saddle brown — distinct from `brown` (wood) so the two browns can sit
  // next to each other on the player mat without blurring. CSS saddlebrown
  // (#8b4513) is redder/warmer than wood's yellow-brown.
  saddleBrown: {
    50: '#fbe9d9',
    300: '#cd9362',
    500: '#8b4513',
    700: '#5a2d0c',
  },
  blueScience: {
    50: '#eff6ff',
    300: '#93c5fd',
    500: '#3b82f6',
    700: '#1d4ed8',
  },
  // Steel-blue — distinct from `grey` (stone) and `slate` (UI surfaces).
  // Anchored on CSS `steelblue` (#4682b4) so the steel resource reads
  // unmistakably blue next to stone's neutral gray.
  steelBlue: {
    50: '#eaf2fb',
    300: '#85a9d3',
    500: '#4682b4',
    700: '#2e5784',
  },
  // Purple — used by the Approval (formerly Happiness) resource. Reads as
  // an abstract / social hue, distinct from the warm production orange.
  purple: {
    50: '#faf5ff',
    300: '#d8b4fe',
    500: '#a855f7',
    700: '#6b21a8',
  },
  teal: {
    50: '#f0fdfa',
    300: '#5eead4',
    500: '#14b8a6',
    700: '#0f766e',
  },
  // Role / event-color ramps. `green` is a generic sage-green ramp
  // separate from `greenFood` so the role/event tokens can shift
  // independently from the food-resource hue.
  green: {
    50: '#f0fdf4',
    300: '#86efac',
    500: '#22c55e',
    700: '#15803d',
  },
  red: {
    50: '#fef2f2',
    300: '#fca5a5',
    500: '#ef4444',
    700: '#b91c1c',
  },
} as const;

// ── helper: build a PaletteColor from a 4-step ramp ──────────────
// Every group below resolves to fully-formed PaletteColor objects so
// `createTheme` accepts them at face value (no PaletteColorOptions
// expansion). `light` = step 300, `main` = step 500, `dark` = step
// 700, `contrastText` = step 50 (used as the on-color text).

type Ramp4 = {
  readonly 50: string;
  readonly 300: string;
  readonly 500: string;
  readonly 700: string;
};

const pc = (r: Ramp4): PaletteColor => ({
  light: r[300],
  main: r[500],
  dark: r[700],
  contrastText: r[50],
});

// ── existing semantic tokens (preserved from pre-09.4) ───────────

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
  //
  // Defense redesign 3.2 — `healthy` / `warning` / `critical` drive the
  // HpPips color states (full / ≤50% / 1) on every damage-bearing
  // building tile. They also paint the per-tile damage / repair flash
  // when `BuildingTile` sees `hp` change between renders.
  status: {
    active: ramps.sky[400],
    muted: ramps.slate[400],
    healthy: ramps.green[500],
    warning: ramps.yellow[500],
    critical: ramps.red[500],
  },

  // App-wide surface fallbacks. Used by CssBaseline (background.default)
  // and the centering wrapper in main.tsx.
  surface: {
    base: ramps.slate[900],
    text: ramps.slate[50],
  },

  // Drop-shadow tokens. Component code reads these via
  // `t.palette.shadow.<key>` so the only `rgba(...)` literals in the
  // codebase live here, alongside the rest of the design tokens.
  shadow: {
    /** Subtle card lift. Used by the canonical CardFrame. */
    card: '0 1px 2px rgba(0,0,0,0.35)',
    /** Floating panel / drawer shadow (Dev sidebar, dialogs). */
    floating: '0 4px 12px rgba(0,0,0,0.4)',
    /** Inset emboss for the player-mat slot panels: a top-edge shadow
     *  + a faint bottom highlight reads as a pressed tray. */
    embossInset:
      'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)',
  },
} as const;

// ── 09.4 per-domain palette groups ───────────────────────────────
// Each group maps a domain enum (Resource / Role / tier / EventColor)
// to a fully-formed PaletteColor. Components consume via
// `t.palette.resource.<key>.main` etc. — no raw hex literals at the
// call site.

// Resource → ramp mapping. Single-letter symbol overrides for collisions
// (stone/steel, science, wood/worker, horse/happiness) live in
// `RESOURCE_DISPLAY` next to the type definition; the colors here pair
// with those symbols.
const resource: Record<Resource, PaletteColor> = {
  gold: pc(ramps.yellow),
  wood: pc(ramps.brown),
  stone: pc(ramps.grey),
  steel: pc(ramps.steelBlue),
  horse: pc(ramps.saddleBrown),
  food: pc(ramps.greenFood),
  production: pc(ramps.orange),
  science: pc(ramps.blueScience),
  happiness: pc(ramps.purple),
  worker: pc(ramps.teal),
};

// Sanity: every RESOURCES key is wired. (Catches a typo at module
// load instead of at first render.) The cast to Ramp4 above is safe
// because `slate` is a superset of the 4 steps `pc` reads.
for (const r of RESOURCES) {
  if (!(r in resource)) {
    throw new Error(`theme: missing resource palette entry for '${r}'`);
  }
}

const role: Record<Role, PaletteColor> = {
  chief: pc(ramps.yellow),
  science: pc(ramps.blueScience),
  domestic: pc(ramps.green),
  defense: pc(ramps.red),
};

const tier: Record<'beginner' | 'intermediate' | 'advanced', PaletteColor> = {
  // Tier surfaces walk the slate ramp from light to dark. `pc()`
  // wants a 4-step ramp, but we only need three distinct shades —
  // synthesize per-tier ramps off the existing slate ramp.
  beginner: {
    light: ramps.slate[300],
    main: ramps.slate[400],
    dark: ramps.slate[600],
    contrastText: ramps.slate[900],
  },
  intermediate: {
    light: ramps.slate[500],
    main: ramps.slate[600],
    dark: ramps.slate[700],
    contrastText: ramps.slate[50],
  },
  advanced: {
    light: ramps.slate[700],
    main: ramps.slate[800],
    dark: ramps.slate[900],
    contrastText: ramps.slate[50],
  },
};

const eventColor: Record<EventColor, PaletteColor> = {
  gold: pc(ramps.yellow),
  blue: pc(ramps.blueScience),
  green: pc(ramps.green),
  red: pc(ramps.red),
};

// Defense redesign 3.2 — center tile (the village vault at (0,0)) palette.
//
// `accent`     — outer ring color so the circular vault reads as different
//                from a regular building tile.
// `surface`    — interior fill so the vault sits visibly above the empty-
//                cell spacer beneath it.
// `text`       — on-`surface` foreground for the label and the live
//                pooled-stash total.
//
// All three resolve to ramp slots — no raw hex literals leak into
// component code. Anchored on `purple` so the vault accent stays
// distinct from the role accents (chief yellow, science blue, domestic
// green, defense red) and from the track's threat / boon / boss accents.
const centerTile = {
  accent: ramps.purple[500],
  surface: ramps.purple[700],
  text: ramps.purple[50],
};

// Defense redesign 3.5 — boss-readout threshold tokens.
//
// The boss readout (rendered when the boss card is the next-card telegraph)
// shows the village's current Science / Economy / Military totals next to
// the boss's required thresholds. Each row reads as either "met" (green) or
// "unmet" (warning amber). Anchored on the existing `green` / `yellow`
// ramps so the tokens compose with the rest of the status palette without
// introducing new hues.
//
// `metAccent`     — border / icon color for a satisfied threshold row.
// `metSurface`    — subtle row tint, sits visibly above the readout's
//                   own surface without washing the foreground text.
// `unmetAccent`   — border / icon color for a pending threshold row.
// `unmetSurface`  — subtle warning tint, paired with `unmetAccent`.
// `text`          — on-surface foreground. Pulled from the same neutral
//                   surface text token as the rest of the strip so met /
//                   unmet rows stay equally readable.
//
// Color is paired with a ✓ / ✗ glyph in the component (CLAUDE.md
// accessibility rule: never communicate state via hue alone).
const bossReadout = {
  metAccent: ramps.green[500],
  metSurface: ramps.green[700],
  unmetAccent: ramps.yellow[500],
  unmetSurface: ramps.yellow[700],
  text: ramps.slate[50],
};

// Defense redesign 3.4 — center-burn banner tokens.
//
// The banner appears in/near the center mat when a threat reaches the
// village vault and burns from the pooled stash. The visual reads as
// "alarm + audit": red border accent for "things were lost" plus a
// dimmed slate surface so the banner can sit over the seat tiles
// without washing them out. Anchored on the existing `red` and `slate`
// ramps so no new hue lands.
//
// `accent`   — border / icon color (alarm red).
// `surface`  — banner background. Slate so the banner reads as a
//              floating panel that's *not* part of the playable grid.
// `text`     — on-`surface` foreground for headline + detail lines.
// `subText`  — slightly muted on-`surface` foreground used for the
//              second line ("to ⚔ Cyclone | round 14").
const centerBurnBanner = {
  accent: ramps.red[500],
  surface: ramps.slate[800],
  text: ramps.slate[50],
  subText: ramps.slate[300],
};

// Defense redesign 3.3 — path-overlay tokens.
//
// The PathOverlay highlights the cells a threat just walked across,
// pulses the impact tiles, and (on a center-burn) ripples from the
// vault outward. All three states share the existing `red` ramp so the
// overlay reads as "incoming threat" without introducing a new hue.
//
// `pathTrail`        — base highlight along every cell on the threat's
//                      path. Soft red so non-impact cells read as
//                      "where it traveled" not "where it hit."
// `pathImpact`       — saturated red for the impact tiles (where the
//                      threat actually consumed HP). Pulses briefly on
//                      animation.
// `pathFire`         — the firing units' tiles (yellow accent) so the
//                      table can read "these are the units that shot."
// `centerRipple`     — purple (matches the centerTile accent) for the
//                      ripple-from-center animation when the threat
//                      reached the vault.
const pathOverlay = {
  pathTrail: ramps.red[300],
  pathImpact: ramps.red[500],
  pathFire: ramps.yellow[300],
  centerRipple: ramps.purple[300],
};

// Defense redesign 3.1 — track strip palette tokens.
//
// `past`     — already-flipped cards, greyed out at the left of the strip.
// `current`  — the just-flipped card, briefly highlighted before sliding
//              into the past row on round transition.
// `next`     — the face-up telegraph card that defense plans against.
// `boss`     — distinct accent for the unique phase-10 boss card so the
//              table reads it as different from a regular threat.
// `phaseMarkers` — gradient across `ramps.purple` so each phase marker
//              above the strip carries a slightly darker shade as the
//              game progresses; phase 10 is the densest. Length 10 so
//              `phaseMarkers[phase - 1]` indexes safely without bounds
//              checks at every call site.
//
// All values resolve to ramp slots — no raw hex literals leak into
// component code. Track-specific shading uses `purple` (already in the
// ramps) for the phase progression and `red` for the boss to match the
// existing `role.defense` accent.
const track = {
  past: ramps.slate[600],
  current: ramps.yellow[500],
  next: ramps.yellow[300],
  boss: ramps.red[500],
  phaseMarkers: [
    ramps.purple[50],
    ramps.purple[300],
    ramps.purple[300],
    ramps.purple[500],
    ramps.purple[500],
    ramps.purple[500],
    ramps.purple[700],
    ramps.purple[700],
    ramps.purple[700],
    ramps.red[700],
  ] as readonly string[],
};

// ── module augmentation ──────────────────────────────────────────

declare module '@mui/material/styles' {
  interface Palette {
    card: typeof colors.card;
    status: typeof colors.status;
    appSurface: typeof colors.surface;
    shadow: typeof colors.shadow;
    resource: Record<Resource, PaletteColor>;
    role: Record<Role, PaletteColor>;
    tier: Record<'beginner' | 'intermediate' | 'advanced', PaletteColor>;
    eventColor: Record<EventColor, PaletteColor>;
    track: {
      past: string;
      current: string;
      next: string;
      boss: string;
      phaseMarkers: readonly string[];
    };
    centerTile: {
      accent: string;
      surface: string;
      text: string;
    };
    bossReadout: {
      metAccent: string;
      metSurface: string;
      unmetAccent: string;
      unmetSurface: string;
      text: string;
    };
    pathOverlay: {
      pathTrail: string;
      pathImpact: string;
      pathFire: string;
      centerRipple: string;
    };
    centerBurnBanner: {
      accent: string;
      surface: string;
      text: string;
      subText: string;
    };
  }
  // PaletteOptions mirrors Palette for the createTheme input. We
  // accept the same shapes (Partial keeps the existing tokens
  // optional, matching MUI's own pattern).
  interface PaletteOptions {
    card?: typeof colors.card;
    status?: typeof colors.status;
    appSurface?: typeof colors.surface;
    shadow?: typeof colors.shadow;
    resource?: Record<Resource, PaletteColor>;
    role?: Record<Role, PaletteColor>;
    tier?: Record<'beginner' | 'intermediate' | 'advanced', PaletteColor>;
    eventColor?: Record<EventColor, PaletteColor>;
    track?: {
      past: string;
      current: string;
      next: string;
      boss: string;
      phaseMarkers: readonly string[];
    };
    centerTile?: {
      accent: string;
      surface: string;
      text: string;
    };
    bossReadout?: {
      metAccent: string;
      metSurface: string;
      unmetAccent: string;
      unmetSurface: string;
      text: string;
    };
    pathOverlay?: {
      pathTrail: string;
      pathImpact: string;
      pathFire: string;
      centerRipple: string;
    };
    centerBurnBanner?: {
      accent: string;
      surface: string;
      text: string;
      subText: string;
    };
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
    shadow: colors.shadow,
    resource,
    role,
    tier,
    eventColor,
    track,
    centerTile,
    bossReadout,
    pathOverlay,
    centerBurnBanner,
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
});
