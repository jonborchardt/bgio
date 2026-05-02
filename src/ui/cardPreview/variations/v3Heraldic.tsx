// Variation 3 — Heraldic Crest.
//
// Each card is "owned" by a role, expressed via a custom SVG shield at
// the top of the card. Dark navy field, metallic gold trim, big
// uppercase title. The crest art is generated per role from primitive
// SVG paths so it's editable / forkable.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import type { Renderer, Variation } from '../types.ts';

const FIELD = '#0c1a2b';
const FIELD_LIGHT = '#16273f';
const TRIM = '#c9a14a';
const TRIM_LIGHT = '#e8cb78';
const TEXT = '#f4ecd1';
const TEXT_FAINT = '#a89866';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.75,
    normal: 1,
    detailed: 1.15,
    page: 1.45,
  };
  return base * k[size];
};

// Per-role icon paths (drawn inside a 24×24 viewBox; centered).
const ROLE_ICON: Record<DisplayCard['role'], string> = {
  // Crown for the chief
  chief:
    'M3 16 L21 16 L21 19 L3 19 Z M5 16 L4 8 L9 12 L12 6 L15 12 L20 8 L19 16',
  // Open book for science
  science:
    'M3 6 Q12 4 12 8 Q12 4 21 6 L21 19 Q12 17 12 21 Q12 17 3 19 Z',
  // Wheat sheaf for domestic
  domestic:
    'M12 3 L12 21 M9 5 Q12 7 15 5 M8 8 Q12 11 16 8 M7 12 Q12 15 17 12 M8 16 Q12 18 16 16',
  // Crossed swords for foreign
  foreign:
    'M5 5 L19 19 M19 5 L5 19 M3 3 L7 7 M17 17 L21 21 M21 3 L17 7 M7 17 L3 21',
};

const Shield = ({
  role,
  size,
}: {
  role: DisplayCard['role'];
  size: CardSize;
}) => {
  const dim = size === 'small' ? 28 : size === 'normal' ? 44 : size === 'detailed' ? 60 : 88;
  return (
    <Box sx={{ width: dim, height: dim, position: 'relative' }}>
      <svg viewBox="0 0 48 56" width="100%" height="100%">
        <defs>
          <linearGradient id={`shield-${role}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={FIELD_LIGHT} />
            <stop offset="1" stopColor={FIELD} />
          </linearGradient>
        </defs>
        {/* Shield body */}
        <path
          d="M4 4 L44 4 L44 28 Q44 50 24 54 Q4 50 4 28 Z"
          fill={`url(#shield-${role}-bg)`}
          stroke={TRIM}
          strokeWidth="2"
        />
        {/* Inner trim */}
        <path
          d="M7 7 L41 7 L41 28 Q41 47 24 51 Q7 47 7 28 Z"
          fill="none"
          stroke={TRIM_LIGHT}
          strokeWidth="0.6"
        />
        {/* Charge */}
        <g transform="translate(12 14)">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              d={ROLE_ICON[role]}
              fill="none"
              stroke={TRIM_LIGHT}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </g>
      </svg>
    </Box>
  );
};

const HeraldicRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        bgcolor: FIELD,
        color: TEXT,
        border: `1px solid ${TRIM}`,
        boxShadow: (t) =>
          `0 0 0 2px ${accent(t, d.role)}66, 0 4px 12px rgba(0,0,0,0.5)`,
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Subtle field texture
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%)',
      }}
    >
      {/* Top — shield + count */}
      <Stack
        direction="row"
        spacing={size === 'small' ? 0.5 : 1}
        sx={{
          alignItems: 'center',
          px: size === 'small' ? 0.75 : 1.25,
          pt: size === 'small' ? 0.5 : 1,
        }}
      >
        <Shield role={d.role} size={size} />
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: fontScale(size, 0.55) + 'rem',
              color: TRIM_LIGHT,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              fontWeight: 700,
            }}
          >
            {d.kindLabel} of the {d.roleLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: fontScale(size, 1) + 'rem',
              fontWeight: 800,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              letterSpacing: -0.2,
              color: TEXT,
            }}
          >
            {d.title}
          </Typography>
          {d.subtitle && size !== 'small' ? (
            <Typography
              sx={{
                fontSize: fontScale(size, 0.65) + 'rem',
                color: TEXT_FAINT,
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
            sx={{
              border: `1px solid ${TRIM}`,
              color: TRIM_LIGHT,
              fontWeight: 800,
              fontSize: fontScale(size, 0.75) + 'rem',
              px: 0.5,
              minWidth: 22,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            ×{d.count}
          </Box>
        ) : null}
      </Stack>

      {/* Divider */}
      <Box
        sx={{
          mx: 1,
          mt: 0.5,
          height: 0,
          borderTop: `1px solid ${TRIM}`,
          opacity: 0.6,
        }}
      />

      {/* Body */}
      <Stack
        spacing={size === 'small' ? 0.25 : 0.6}
        sx={{
          px: size === 'small' ? 0.75 : 1.25,
          py: size === 'small' ? 0.4 : 0.75,
          flex: 1,
        }}
      >
        {d.stats ? (
          <Stack
            direction="row"
            spacing={size === 'small' ? 0.5 : 1}
            sx={{ justifyContent: 'space-around' }}
          >
            {d.stats.map((s) => (
              <Stack key={s.label} sx={{ alignItems: 'center' }}>
                <Typography
                  sx={{
                    fontSize: fontScale(size, 1.1) + 'rem',
                    fontWeight: 800,
                    color: TRIM_LIGHT,
                    lineHeight: 1,
                    textShadow: '0 1px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: fontScale(size, 0.5) + 'rem',
                    color: TEXT_FAINT,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {s.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {d.cost && d.cost.bag.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: 'wrap', rowGap: 0.5, justifyContent: 'center' }}
          >
            {size === 'small' ? (
              <Typography sx={{ fontSize: '0.6rem', color: TRIM_LIGHT }}>
                {d.cost.short}
              </Typography>
            ) : (
              d.cost.bag.map((b) => (
                <Box
                  key={b.resource}
                  sx={{
                    border: `1px solid ${TRIM}`,
                    px: 0.5,
                    fontSize: fontScale(size, 0.6) + 'rem',
                    color: TRIM_LIGHT,
                    bgcolor: 'rgba(0,0,0,0.25)',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  {b.count} {b.resource}
                </Box>
              ))
            )}
          </Stack>
        ) : null}

        {d.benefit && size !== 'small' ? (
          <Typography
            sx={{
              fontSize: fontScale(size, 0.7) + 'rem',
              textAlign: 'center',
              color: TEXT,
              lineHeight: 1.3,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {d.effects && (size === 'detailed' || size === 'page') ? (
          <Stack spacing={0.35} sx={{ pt: 0.25 }}>
            {d.effects.map((e) => (
              <Stack
                key={e.label}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'baseline',
                  px: 0.5,
                  py: 0.25,
                  borderLeft: '3px solid',
                  borderColor: (t) =>
                    e.color
                      ? t.palette.eventColor[e.color].main
                      : TRIM,
                  bgcolor: e.emphasized ? 'rgba(201,161,74,0.12)' : 'transparent',
                }}
              >
                <Typography
                  sx={{
                    fontSize: fontScale(size, 0.55) + 'rem',
                    fontWeight: 800,
                    color: TRIM_LIGHT,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    minWidth: 60,
                  }}
                >
                  {e.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: fontScale(size, 0.7) + 'rem',
                    color: TEXT,
                    lineHeight: 1.3,
                  }}
                >
                  {e.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              mt: 'auto',
              pt: 1,
              fontStyle: 'italic',
              color: TEXT_FAINT,
              fontSize: '0.85rem',
              textAlign: 'center',
              borderTop: `1px solid ${TRIM}55`,
              lineHeight: 1.45,
            }}
          >
            {d.flavor}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v3Heraldic: Variation = {
  id: 'heraldic',
  name: 'Heraldic Crest',
  blurb:
    'Navy field with gold trim. SVG shield + per-role charge (crown, book, wheat, swords) anchors every card.',
  Renderer: HeraldicRenderer,
};
