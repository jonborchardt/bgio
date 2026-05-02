// Variation 5 — Storybook.
//
// Soft pastel role hues, hand-drawn SVG borders (deliberately wobbly
// stroke), playful display font, tilted cards, friendly resource bubbles.
// The aim is "children's storybook page" rather than "spreadsheet of
// stats". The illustration accent is an SVG watercolor blob behind the
// title.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#fffaf3';
const INK = '#3a2c2a';
const INK_FAINT = '#86766f';
const DISPLAY = '"Caveat", "Marker Felt", "Comic Sans MS", cursive, sans-serif';
const BODY = '"Quicksand", "Avenir Next", system-ui, sans-serif';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].light;

const accentDark = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].dark;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.8,
    normal: 1,
    detailed: 1.18,
    page: 1.5,
  };
  return base * k[size];
};

// Wobbly border drawn as SVG with a slight Bézier wiggle so corners feel
// drawn by hand rather than vector-perfect.
const HandDrawnBorder = ({ color }: { color: string }) => (
  <Box
    aria-hidden
    sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <svg width="100%" height="100%" preserveAspectRatio="none">
      <path
        d="M 8,4
           Q 4,4 4,10
           L 4,calc(100% - 10)
           Q 4,calc(100% - 4) 10,calc(100% - 4)
           L calc(100% - 12),calc(100% - 4)
           Q calc(100% - 5),calc(100% - 5) calc(100% - 4),calc(100% - 12)
           L calc(100% - 4),12
           Q calc(100% - 4),5 calc(100% - 11),4
           Z"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </Box>
);

const Bubble = ({
  resource,
  count,
  size,
}: {
  resource: string;
  count: number;
  size: CardSize;
}) => {
  const dim = size === 'small' ? 18 : size === 'normal' ? 26 : size === 'detailed' ? 32 : 42;
  return (
    <Stack sx={{ alignItems: 'center', minWidth: dim }}>
      <Box
        aria-hidden
        sx={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          bgcolor: (t) => t.palette.resource[resource as 'gold'].light,
          color: (t) => t.palette.resource[resource as 'gold'].dark,
          border: `1.5px solid ${INK}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: dim * 0.55,
          boxShadow: '2px 3px 0 rgba(58,44,42,0.18)',
        }}
      >
        {count}
      </Box>
      {size !== 'small' ? (
        <Typography
          sx={{
            fontFamily: BODY,
            fontSize: fontScale(size, 0.55) + 'rem',
            color: INK_FAINT,
            mt: 0.25,
          }}
        >
          {resource}
        </Typography>
      ) : null}
    </Stack>
  );
};

const StorybookRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  // Each kind tilts a tiny bit so a row doesn't feel mechanical.
  const tilt: Record<DisplayCard['kind'], number> = {
    domesticBuilding: -1,
    domesticBuildingComplex: 0.8,
    placedVillage: 1.4,
    scienceCard: -0.6,
    scienceAdvanced: 1.1,
    foreignUnit: 1,
    army: -1.2,
    chiefTech: 0.6,
    chiefTechGrant: -0.8,
  };

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        position: 'relative',
        bgcolor: PAPER,
        color: INK,
        fontFamily: BODY,
        borderRadius: 2,
        boxShadow: '4px 5px 0 rgba(58,44,42,0.18)',
        transform: `rotate(${tilt[d.kind]}deg)`,
        transformOrigin: 'center top',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Watercolour blob behind the title, in the role accent. */}
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          top: -10,
          right: -8,
          width: size === 'small' ? 30 : size === 'normal' ? 60 : size === 'detailed' ? 80 : 120,
          height: size === 'small' ? 30 : size === 'normal' ? 60 : size === 'detailed' ? 80 : 120,
          opacity: 0.45,
          pointerEvents: 'none',
          color: accent(t, d.role),
        })}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <path
            d="M50 6 Q84 14 92 48 Q88 84 54 92 Q18 88 8 54 Q12 18 50 6 Z"
            fill="currentColor"
          />
        </svg>
      </Box>

      <Box sx={(t) => ({ position: 'absolute', inset: 0, color: accentDark(t, d.role) })}>
        <HandDrawnBorder color="currentColor" />
      </Box>

      <Stack
        spacing={size === 'small' ? 0.25 : 0.5}
        sx={{
          position: 'relative',
          px: size === 'small' ? 0.85 : 1.4,
          py: size === 'small' ? 0.5 : 0.85,
          flex: 1,
        }}
      >
        {/* Header: kind chip + count */}
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box
            sx={(t) => ({
              fontFamily: BODY,
              fontSize: fontScale(size, 0.55) + 'rem',
              color: accentDark(t, d.role),
              bgcolor: accent(t, d.role),
              px: 0.6,
              py: 0.1,
              borderRadius: 1,
              border: `1px solid ${INK}`,
              fontWeight: 700,
              textTransform: 'lowercase',
              letterSpacing: 0.2,
            })}
          >
            {d.kindLabel.toLowerCase()} · {d.roleLabel.toLowerCase()}
          </Box>
          {d.count !== undefined && d.count > 1 ? (
            <Typography
              sx={{
                fontFamily: DISPLAY,
                fontSize: fontScale(size, 1.2) + 'rem',
                color: INK,
                lineHeight: 1,
              }}
            >
              ×{d.count}
            </Typography>
          ) : null}
        </Stack>

        {/* Title */}
        <Typography
          sx={{
            fontFamily: DISPLAY,
            fontSize: fontScale(size, 1.4) + 'rem',
            fontWeight: 700,
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {d.title}
        </Typography>

        {size !== 'small' && d.subtitle ? (
          <Typography
            sx={{
              fontFamily: BODY,
              fontSize: fontScale(size, 0.7) + 'rem',
              color: INK_FAINT,
              fontStyle: 'italic',
              lineHeight: 1.25,
            }}
          >
            {d.subtitle}
          </Typography>
        ) : null}

        {/* Stats — bubbled */}
        {d.stats && size !== 'small' ? (
          <Stack direction="row" spacing={1} sx={{ pt: 0.25 }}>
            {d.stats.map((s) => (
              <Stack key={s.label} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    fontFamily: DISPLAY,
                    fontSize: fontScale(size, 1.2) + 'rem',
                    fontWeight: 700,
                    color: INK,
                    border: `1.5px solid ${INK}`,
                    borderRadius: '50%',
                    width: size === 'page' ? 36 : 28,
                    height: size === 'page' ? 36 : 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {s.value}
                </Box>
                <Typography
                  sx={{
                    fontFamily: BODY,
                    fontSize: fontScale(size, 0.55) + 'rem',
                    color: INK_FAINT,
                    mt: 0.25,
                  }}
                >
                  {s.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {d.stats && size === 'small' ? (
          <Typography
            sx={{
              fontFamily: BODY,
              fontSize: '0.6rem',
              color: INK,
              fontWeight: 700,
            }}
          >
            {d.stats.map((s) => `${s.label[0]}${s.value}`).join(' · ')}
          </Typography>
        ) : null}

        {/* Cost */}
        {d.cost && d.cost.bag.length > 0 ? (
          size === 'small' ? (
            <Typography
              sx={{
                fontFamily: BODY,
                fontSize: '0.65rem',
                color: (t) => t.palette.resource.gold.dark,
                fontWeight: 700,
              }}
            >
              {d.cost.short}
            </Typography>
          ) : (
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ flexWrap: 'wrap', rowGap: 0.5, pt: 0.25 }}
            >
              {d.cost.bag.map((b) => (
                <Bubble
                  key={b.resource}
                  resource={b.resource}
                  count={b.count}
                  size={size}
                />
              ))}
            </Stack>
          )
        ) : null}

        {/* Benefit */}
        {d.benefit && size !== 'small' ? (
          <Typography
            sx={{
              fontFamily: BODY,
              fontSize: fontScale(size, 0.75) + 'rem',
              color: INK,
              lineHeight: 1.4,
              pt: 0.25,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Effects */}
        {d.effects && (size === 'detailed' || size === 'page') ? (
          <Stack spacing={0.4} sx={{ pt: 0.5 }}>
            {d.effects.map((e) => (
              <Box
                key={e.label}
                sx={{
                  px: 0.75,
                  py: 0.35,
                  bgcolor: e.emphasized
                    ? 'rgba(255,235,180,0.45)'
                    : 'rgba(255,255,255,0.55)',
                  borderRadius: 1,
                  border: `1px dashed ${INK_FAINT}`,
                }}
              >
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY,
                      fontSize: fontScale(size, 0.85) + 'rem',
                      color: (t) =>
                        e.color
                          ? t.palette.eventColor[e.color].dark
                          : INK_FAINT,
                      fontWeight: 700,
                    }}
                  >
                    {e.label}:
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: BODY,
                      fontSize: fontScale(size, 0.7) + 'rem',
                      color: INK,
                      lineHeight: 1.3,
                    }}
                  >
                    {e.text}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}

        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              mt: 'auto',
              pt: 1,
              fontFamily: DISPLAY,
              fontSize: '1.05rem',
              color: INK_FAINT,
              fontStyle: 'italic',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            “{d.flavor}”
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v5Storybook: Variation = {
  id: 'storybook',
  name: 'Storybook',
  blurb:
    'Soft pastels, hand-drawn SVG borders, watercolour blob behind the title, friendly bubble icons, slight tilt.',
  Renderer: StorybookRenderer,
};
