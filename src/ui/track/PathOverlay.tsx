// Defense redesign 3.3 — path overlay layer.
//
// Reads the currently-animating `ResolveTrace` from
// `ResolveAnimationContext` and renders three short-lived visuals over
// the domestic grid:
//
//   1. A directional path arrow (or just the highlighted tile-set when
//      the path is short) painted from the threat's entry edge to its
//      furthest-traversed cell. Implemented as a positioned `<svg>`
//      whose viewBox covers the same logical grid as <BuildingGrid> so
//      the line lands on the cells the resolver actually walked.
//   2. Impact-tile pulse — a brief `boxShadow` ring on each cell key in
//      `trace.impactTiles`. The grid cells consume the highlight via a
//      sibling consumer (BuildingGrid → CellSlot) reading the same
//      context, so this component itself only paints the overlay; the
//      tile-level pulse is layered inside the BuildingGrid render.
//   3. Center-burn ripple — when `trace.centerBurned > 0`, a pulsing
//      circular gradient anchored on the center tile.
//
// The component captures NO clicks (`pointer-events: none` on the
// outer wrapper) so it can layer above any interactive UI without
// stealing focus or input.

import { useContext, useMemo } from 'react';
import { Box } from '@mui/material';
import { ResolveAnimationContext } from './resolveAnimation.ts';
import { useReducedMotion } from '../layout/useReducedMotion.ts';

export interface PathOverlayProps {
  /** Optional — when not supplied, the overlay calculates its own
   *  bounds from the path tiles themselves. Supplying explicit bounds
   *  lets the overlay align with a specific BuildingGrid render. */
  bounds?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

/**
 * Compute a bounding box around the trace path. When the path is empty
 * (defensive), returns a centered 3x3 fallback so the SVG still renders.
 */
const computeOverlayBounds = (
  pathTiles: ReadonlyArray<{ x: number; y: number }>,
): { xMin: number; xMax: number; yMin: number; yMax: number } => {
  if (pathTiles.length === 0) {
    return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  }
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const t of pathTiles) {
    if (t.x < xMin) xMin = t.x;
    if (t.x > xMax) xMax = t.x;
    if (t.y < yMin) yMin = t.y;
    if (t.y > yMax) yMax = t.y;
  }
  return { xMin, xMax, yMin, yMax };
};

export function PathOverlay({ bounds }: PathOverlayProps) {
  const { current } = useContext(ResolveAnimationContext);
  // Defense redesign 3.9 — respect `prefers-reduced-motion`. When set,
  // the overlay drops its keyframe animation and lingers at full
  // opacity for a single frame instead of pulsing through fade-in /
  // fade-out. The trace is still painted so the table reads "where the
  // threat went," but no motion plays.
  const reducedMotion = useReducedMotion();

  // No active animation → render nothing. The wrapper is hidden so the
  // overlay also doesn't reserve layout space when idle.
  const trace = current;

  const overlayBounds = useMemo(
    () =>
      bounds ?? computeOverlayBounds(trace?.pathTiles ?? []),
    [bounds, trace?.pathTiles],
  );

  if (trace === null || trace.pathTiles.length === 0) {
    return null;
  }

  const cols = overlayBounds.xMax - overlayBounds.xMin + 1;
  const rows = overlayBounds.yMax - overlayBounds.yMin + 1;
  // Map a logical (x, y) to SVG viewBox coordinates. SVG y descends, so
  // we flip via `(yMax - y)` to match the BuildingGrid's "y descends
  // visually" convention.
  const toSvg = (x: number, y: number): { sx: number; sy: number } => ({
    sx: x - overlayBounds.xMin + 0.5,
    sy: overlayBounds.yMax - y + 0.5,
  });

  // Build the polyline points string.
  const pointsStr = trace.pathTiles
    .map((t) => {
      const { sx, sy } = toSvg(t.x, t.y);
      return `${sx},${sy}`;
    })
    .join(' ');

  const tail = trace.pathTiles[trace.pathTiles.length - 1];
  const head = trace.pathTiles[0];

  return (
    <Box
      data-testid="path-overlay"
      data-trace-outcome={trace.outcome}
      aria-hidden
      sx={(t) => ({
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        // Hoist theme tokens onto CSS variables so the SVG strokes and
        // fills resolve to theme colors without inlining raw hex
        // literals at the call site.
        '--path-trail-color': t.palette.pathOverlay.pathTrail,
        '--path-impact-color': t.palette.pathOverlay.pathImpact,
        '--path-center-ripple-color':
          t.palette.pathOverlay.centerRipple,
      })}
    >
      <Box
        component="svg"
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        viewBox={`0 0 ${cols} ${rows}`}
        preserveAspectRatio="none"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          // CSS animation: the path fades in then *holds* for the
          // duration of the playback step (the provider clears `current`
          // at trace end, which unmounts the SVG). Reduced-motion users
          // skip the fade and see the overlay at full opacity from the
          // first frame.
          opacity: 0.85,
          animation: reducedMotion
            ? 'none'
            : 'pathOverlayFadeIn 220ms ease-out forwards',
          '@keyframes pathOverlayFadeIn': {
            '0%': { opacity: 0 },
            '100%': { opacity: 0.85 },
          },
        }}
      >
        {/* Path lane — broad translucent band tracing the threat's
            walked route. */}
        <polyline
          points={pointsStr}
          fill="none"
          stroke="var(--path-trail-color)"
          strokeWidth="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Head dot — the entry point, slightly larger so the table
            reads "the threat came in here." */}
        {head !== undefined ? (
          <circle
            cx={toSvg(head.x, head.y).sx}
            cy={toSvg(head.x, head.y).sy}
            r={0.18}
            fill="var(--path-trail-color)"
          />
        ) : null}
        {/* Tail marker — where the threat ended up (impact / center). */}
        {tail !== undefined ? (
          <circle
            cx={toSvg(tail.x, tail.y).sx}
            cy={toSvg(tail.x, tail.y).sy}
            r={0.22}
            fill="var(--path-impact-color)"
          />
        ) : null}
        {/* Center ripple — a pulsing circle on the vault when the
            threat reached center. */}
        {trace.outcome === 'reachedCenter' &&
        (trace.centerBurned ?? 0) > 0 ? (
          <circle
            cx={toSvg(0, 0).sx}
            cy={toSvg(0, 0).sy}
            r={0.4}
            fill="none"
            stroke="var(--path-center-ripple-color)"
            strokeWidth="0.1"
            opacity={0.7}
          />
        ) : null}
      </Box>
    </Box>
  );
}

export default PathOverlay;
