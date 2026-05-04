// Per-kind SVG glyphs. Each card kind gets its own visually distinct
// silhouette: building / village / unit / army / science cell / tech
// scroll. Variations use these as kind badges (vs role color, which is
// orthogonal). The glyphs are stroke-only so a variation can recolour
// the entire mark via `currentColor`.
//
// Shared so all "good" variations stay consistent on iconography even
// while their typography / surface treatments diverge.

import { Box } from '@mui/material';
import type { SampleCardKind } from './types.ts';

export interface KindGlyphProps {
  kind: SampleCardKind;
  size?: number;
  /** Stroke / fill colour. Defaults to currentColor so variations can
   *  set color via the `sx` prop on a wrapper. */
  color?: string;
  /** When true, draws filled silhouettes; otherwise stroked outlines. */
  filled?: boolean;
}

const PATHS: Record<
  SampleCardKind,
  { viewBox: string; d: string; extra?: string }
> = {
  // Pitched-roof building with a chimney + door + window slit.
  domesticBuilding: {
    viewBox: '0 0 32 32',
    d: 'M4 14 L16 4 L28 14 L28 28 L4 28 Z M22 6 L22 10 L25 10 L25 7',
    extra:
      'M13 18 L19 18 L19 28 L13 28 Z M8 16 L11 16 L11 19 L8 19 Z M21 16 L24 16 L24 19 L21 19 Z',
  },
  // Multi-cost / advanced building — anvil + hammer silhouette.
  domesticBuildingComplex: {
    viewBox: '0 0 32 32',
    d: 'M5 18 L27 18 L25 24 L7 24 Z M9 18 L9 14 L13 14 L13 18 M19 18 L19 14 L23 14 L23 18',
    extra: 'M16 4 L24 12 M22 6 L26 10',
  },
  // Cluster of three small houses (a village).
  placedVillage: {
    viewBox: '0 0 32 32',
    d: 'M3 16 L9 10 L15 16 L15 26 L3 26 Z M14 18 L19 13 L24 18 L24 26 L14 26 Z M22 20 L26 16 L30 20 L30 26 L22 26 Z',
    extra: 'M7 22 L7 26 M18 22 L18 26 M26 23 L26 26',
  },
  // Beaker (science L0+) with tick marks.
  scienceCard: {
    viewBox: '0 0 32 32',
    d: 'M11 4 L11 12 L6 24 Q6 28 12 28 L20 28 Q26 28 26 24 L21 12 L21 4 Z',
    extra: 'M9 4 L23 4 M11 17 L21 17',
  },
  // Pyramid of nested flasks — feels more "advanced lab".
  scienceAdvanced: {
    viewBox: '0 0 32 32',
    d: 'M13 4 L13 10 L8 22 Q8 26 13 26 L19 26 Q24 26 24 22 L19 10 L19 4 Z',
    extra: 'M11 4 L21 4 M13 14 L19 14 M16 18 L16 22',
  },
  // Helmeted soldier head + spear.
  defenseUnit: {
    viewBox: '0 0 32 32',
    d: 'M9 15 Q9 8 16 8 Q23 8 23 15 L23 18 L19 18 L19 22 Q16 23 13 22 L13 18 L9 18 Z',
    extra: 'M16 23 L16 28 M8 6 L24 6',
  },
  // Three crossed spears — an army formation.
  army: {
    viewBox: '0 0 32 32',
    d: 'M6 28 L26 4 M16 28 L16 4 M26 28 L6 4',
    extra: 'M5 5 L9 9 M27 5 L23 9 M14 4 L18 4',
  },
  // Open scroll (tech).
  chiefTech: {
    viewBox: '0 0 32 32',
    d: 'M5 8 Q5 5 8 5 L24 5 Q27 5 27 8 L27 24 Q27 27 24 27 L8 27 Q5 27 5 24 Z',
    extra: 'M9 11 L23 11 M9 15 L21 15 M9 19 L23 19',
  },
  // Scroll with a star — "grants cards".
  chiefTechGrant: {
    viewBox: '0 0 32 32',
    d: 'M5 8 Q5 5 8 5 L24 5 Q27 5 27 8 L27 24 Q27 27 24 27 L8 27 Q5 27 5 24 Z',
    extra:
      'M16 9 L17.5 13 L21.5 13 L18.5 15.5 L19.5 19.5 L16 17 L12.5 19.5 L13.5 15.5 L10.5 13 L14.5 13 Z',
  },
};

export function KindGlyph({
  kind,
  size = 24,
  color = 'currentColor',
  filled = false,
}: KindGlyphProps) {
  const { viewBox, d, extra } = PATHS[kind];
  const stroke = color;
  const fill = filled ? color : 'none';
  const fillOpacity = filled ? 0.18 : 0;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        width: size,
        height: size,
        color,
        flexShrink: 0,
      }}
    >
      <svg viewBox={viewBox} width={size} height={size}>
        <path
          d={d}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill}
          fillOpacity={fillOpacity}
        />
        {extra ? (
          <path
            d={extra}
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </svg>
    </Box>
  );
}

export default KindGlyph;
