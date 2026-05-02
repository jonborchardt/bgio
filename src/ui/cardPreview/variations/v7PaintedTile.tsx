// Variation 7 — Painted Tile.
//
// Storybook's wins (warm palette, SVG glyphs, bubble resources) without
// the tilt and with the missing data restored. Big per-kind SVG glyph
// in a watercolour disc, role-coloured "For you" banner, role-coloured
// Grants lines for buildings/units, full event-line list at detailed/
// page, friendly bubble resources, framed unit stats.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import { KindGlyph } from '../kindGlyphs.tsx';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#fff8ef';
const PAPER_BORDER = '#d8c8a8';
const INK = '#2c241c';
const INK_FAINT = '#7a6957';
const HEADING = '"Quicksand", "Avenir Next", system-ui, sans-serif';
const BODY = '"Inter", "Segoe UI", system-ui, sans-serif';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;
const accentLight = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].light;
const accentDark = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].dark;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.78,
    normal: 1,
    detailed: 1.15,
    page: 1.45,
  };
  return base * k[size];
};

const ResourceBubble = ({
  resource,
  count,
  size,
}: {
  resource: string;
  count: number;
  size: CardSize;
}) => {
  const dim = size === 'small' ? 18 : size === 'normal' ? 24 : size === 'detailed' ? 30 : 38;
  return (
    <Stack sx={{ alignItems: 'center', minWidth: dim }}>
      <Box
        sx={(t) => ({
          width: dim,
          height: dim,
          borderRadius: '50%',
          bgcolor: t.palette.resource[resource as 'gold'].light,
          color: t.palette.resource[resource as 'gold'].dark,
          border: `1.5px solid ${t.palette.resource[resource as 'gold'].dark}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: HEADING,
          fontWeight: 800,
          fontSize: dim * 0.55,
          lineHeight: 1,
          boxShadow: '1px 1px 0 rgba(44,36,28,0.12)',
        })}
      >
        {count}
      </Box>
      {size !== 'small' ? (
        <Typography
          sx={{
            fontFamily: BODY,
            fontSize: fontScale(size, 0.55) + 'rem',
            color: INK_FAINT,
            mt: 0.2,
            textTransform: 'lowercase',
          }}
        >
          {resource}
        </Typography>
      ) : null}
    </Stack>
  );
};

const StatFrame = ({
  label,
  value,
  size,
}: {
  label: string;
  value: string;
  size: CardSize;
}) => (
  <Stack
    sx={{
      alignItems: 'center',
      px: size === 'small' ? 0.4 : 0.7,
      py: size === 'small' ? 0.15 : 0.35,
      border: `1.5px solid ${INK}`,
      borderRadius: 1,
      bgcolor: 'rgba(255,255,255,0.7)',
      minWidth: size === 'small' ? 24 : 36,
    }}
  >
    <Typography
      sx={{
        fontFamily: HEADING,
        fontSize: fontScale(size, 1.05) + 'rem',
        fontWeight: 800,
        color: INK,
        lineHeight: 1,
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontFamily: BODY,
        fontSize: fontScale(size, 0.5) + 'rem',
        color: INK_FAINT,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {label}
    </Typography>
  </Stack>
);

const PaintedTileRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  const showFull = size === 'detailed' || size === 'page';
  const showSomeLines = size === 'normal' || showFull;
  const glyphDim = size === 'small' ? 26 : size === 'normal' ? 38 : size === 'detailed' ? 50 : 70;
  const blobDim = glyphDim + 18;

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        bgcolor: PAPER,
        color: INK,
        fontFamily: BODY,
        border: `1.5px solid ${PAPER_BORDER}`,
        borderRadius: 2,
        boxShadow: '2px 3px 0 rgba(44,36,28,0.18)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header strip with watercolour disc + glyph */}
      <Stack
        direction="row"
        spacing={size === 'small' ? 0.5 : 0.75}
        sx={{
          alignItems: 'center',
          px: size === 'small' ? 0.6 : 1,
          pt: size === 'small' ? 0.4 : 0.65,
          pb: size === 'small' ? 0.3 : 0.4,
        }}
      >
        <Box
          sx={(t) => ({
            position: 'relative',
            width: blobDim,
            height: blobDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentDark(t, d.role),
            flexShrink: 0,
          })}
        >
          <Box
            aria-hidden
            sx={(t) => ({
              position: 'absolute',
              inset: 0,
              opacity: 0.55,
              color: accentLight(t, d.role),
            })}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <path
                d="M50 6 Q84 14 92 48 Q88 84 54 92 Q18 88 8 54 Q12 18 50 6 Z"
                fill="currentColor"
              />
            </svg>
          </Box>
          <Box sx={{ position: 'relative' }}>
            <KindGlyph kind={d.kind} size={glyphDim} />
          </Box>
        </Box>

        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={(t) => ({
              fontFamily: BODY,
              fontSize: fontScale(size, 0.55) + 'rem',
              color: accentDark(t, d.role),
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontWeight: 700,
            })}
          >
            {d.kindLabel} · {d.roleLabel}
          </Typography>
          <Typography
            sx={{
              fontFamily: HEADING,
              fontSize: fontScale(size, 1.15) + 'rem',
              fontWeight: 800,
              lineHeight: 1.05,
              color: INK,
            }}
          >
            {d.title}
          </Typography>
          {showSomeLines && d.subtitle ? (
            <Typography
              sx={{
                fontFamily: BODY,
                fontSize: fontScale(size, 0.65) + 'rem',
                color: INK_FAINT,
                fontStyle: 'italic',
                lineHeight: 1.2,
              }}
            >
              {d.subtitle}
            </Typography>
          ) : null}
        </Stack>

        {d.count !== undefined && d.count > 1 ? (
          <Box
            sx={(t) => ({
              fontFamily: HEADING,
              fontSize: fontScale(size, 1) + 'rem',
              fontWeight: 800,
              color: '#fff',
              bgcolor: accentDark(t, d.role),
              px: 0.6,
              py: 0.1,
              borderRadius: 999,
              border: `1.5px solid ${INK}`,
            })}
          >
            ×{d.count}
          </Box>
        ) : null}
      </Stack>

      {/* Body */}
      <Stack
        spacing={size === 'small' ? 0.3 : 0.55}
        sx={{
          px: size === 'small' ? 0.6 : 1,
          pb: size === 'small' ? 0.5 : 0.8,
          flex: 1,
        }}
      >
        {/* Stats */}
        {d.stats ? (
          <Stack direction="row" spacing={size === 'small' ? 0.3 : 0.5}>
            {d.stats.map((s) => (
              <StatFrame key={s.label} label={s.label} value={s.value} size={size} />
            ))}
          </Stack>
        ) : null}

        {/* Cost — bubble icons */}
        {d.cost && d.cost.bag.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.4 }}>
            <Typography
              sx={{
                fontSize: fontScale(size, 0.55) + 'rem',
                color: INK_FAINT,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 700,
                mr: 0.25,
              }}
            >
              Cost
            </Typography>
            {d.cost.bag.map((b) => (
              <ResourceBubble
                key={b.resource}
                resource={b.resource}
                count={b.count}
                size={size}
              />
            ))}
          </Stack>
        ) : null}

        {/* Benefit (non-grant cards) */}
        {!d.grants && d.benefit && showSomeLines ? (
          <Typography
            sx={{
              fontFamily: BODY,
              fontSize: fontScale(size, 0.78) + 'rem',
              color: INK,
              lineHeight: 1.4,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Grants — each role-coloured */}
        {d.grants && showSomeLines ? (
          <Stack spacing={0.4}>
            {d.grants.map((g) => (
              <Box
                key={g.label}
                sx={(t) => ({
                  borderLeft: `5px solid ${accent(t, g.role)}`,
                  borderRadius: '0 6px 6px 0',
                  bgcolor: `${accentLight(t, g.role)}99`,
                  px: 0.75,
                  py: 0.3,
                })}
              >
                <Typography
                  sx={(t) => ({
                    fontFamily: HEADING,
                    fontSize: fontScale(size, 0.7) + 'rem',
                    fontWeight: 800,
                    color: accentDark(t, g.role),
                    lineHeight: 1.1,
                  })}
                >
                  Grants → {g.label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: BODY,
                    fontSize: fontScale(size, 0.7) + 'rem',
                    color: INK,
                    lineHeight: 1.3,
                    fontWeight: 600,
                  }}
                >
                  {g.items}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : null}

        {/* Effects */}
        {d.effects ? (
          <Stack spacing={0.3}>
            {(showFull ? d.effects : d.effects.slice(0, 1)).map((e) => (
              <Box
                key={e.label}
                sx={(t) => ({
                  pl: 0.75,
                  pr: 0.5,
                  py: 0.25,
                  borderLeft: `4px solid ${
                    e.color
                      ? t.palette.eventColor[e.color].main
                      : INK_FAINT
                  }`,
                  bgcolor: e.emphasized
                    ? `${
                        e.color
                          ? t.palette.eventColor[e.color].light
                          : '#fff'
                      }cc`
                    : 'rgba(255,255,255,0.4)',
                  borderRadius: '0 6px 6px 0',
                })}
              >
                <Typography
                  sx={(t) => ({
                    fontFamily: HEADING,
                    fontSize: fontScale(size, 0.65) + 'rem',
                    fontWeight: 800,
                    color: e.color
                      ? t.palette.eventColor[e.color].dark
                      : INK_FAINT,
                    lineHeight: 1.1,
                  })}
                >
                  {e.emphasized ? `For you (${e.label})` : e.label}
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
              </Box>
            ))}
          </Stack>
        ) : null}

        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              mt: 'auto',
              pt: 1,
              fontFamily: HEADING,
              fontSize: '1rem',
              fontStyle: 'italic',
              color: INK_FAINT,
              textAlign: 'center',
              lineHeight: 1.4,
              borderTop: `1px dashed ${INK_FAINT}66`,
            }}
          >
            “{d.flavor}”
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v7PaintedTile: Variation = {
  id: 'paintedTile',
  name: 'Painted Tile',
  blurb:
    'Warm paper, big watercolour disc with a unique kind glyph, bubble resources, role-coloured Grants blocks, every event line visible, no tilt.',
  Renderer: PaintedTileRenderer,
};
