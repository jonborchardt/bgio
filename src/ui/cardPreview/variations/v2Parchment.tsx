// Variation 2 — Parchment Vintage.
//
// Warm cream paper, serif typography, dark sepia text. The role colour
// shows up as a banner ribbon across the top, and the cost / stats use
// boxed labels reminiscent of old wargame counters. Decorative SVG
// flourishes anchor the corners on detailed / page sizes.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#f7eed8';
const PAPER_EDGE = '#e6d4ae';
const INK = '#3a2a14';
const INK_FAINT = '#7a5d36';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].dark;

const fontSize = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.75,
    normal: 1,
    detailed: 1.15,
    page: 1.45,
  };
  return base * k[size];
};

// Tiny SVG corner flourish — drawn in INK_FAINT.
const Flourish = ({ flip = false }: { flip?: boolean }) => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      top: flip ? undefined : 4,
      bottom: flip ? 4 : undefined,
      right: flip ? undefined : 4,
      left: flip ? 4 : undefined,
      width: 28,
      height: 28,
      transform: flip ? 'rotate(180deg)' : 'none',
      pointerEvents: 'none',
      opacity: 0.35,
    }}
  >
    <svg viewBox="0 0 28 28" width="100%" height="100%">
      <path
        d="M2 2 L14 2 M2 2 L2 14 M2 2 Q10 6 14 14 M14 2 Q10 8 6 12"
        stroke={INK_FAINT}
        fill="none"
        strokeWidth="0.8"
      />
      <circle cx="2" cy="2" r="1.5" fill={INK_FAINT} />
    </svg>
  </Box>
);

const StatBox = ({
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
      px: size === 'small' ? 0.4 : 0.75,
      py: size === 'small' ? 0.2 : 0.4,
      border: `1px solid ${INK_FAINT}`,
      bgcolor: 'rgba(255,255,255,0.35)',
      minWidth: size === 'small' ? 22 : 36,
    }}
  >
    <Typography
      sx={{
        fontFamily: SERIF,
        fontSize: fontSize(size, 0.95) + 'rem',
        fontWeight: 700,
        lineHeight: 1,
        color: INK,
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontSize: fontSize(size, 0.5) + 'rem',
        color: INK_FAINT,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {label}
    </Typography>
  </Stack>
);

const ParchmentRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];

  return (
    <Box
      sx={{
        position: 'relative',
        width: w,
        minHeight: h,
        background: `radial-gradient(circle at 25% 15%, #fdf6e3 0%, ${PAPER} 55%, ${PAPER_EDGE} 100%)`,
        color: INK,
        fontFamily: SERIF,
        border: `1px solid ${INK_FAINT}`,
        boxShadow: 'inset 0 0 14px rgba(120,80,30,0.18), 0 2px 4px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Role banner */}
      <Box
        sx={{
          bgcolor: (t) => accent(t, d.role),
          color: '#f7eed8',
          px: 1,
          py: size === 'small' ? 0.25 : 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `2px double ${INK}`,
        }}
      >
        <Typography
          sx={{
            fontFamily: SERIF,
            fontSize: fontSize(size, 0.65) + 'rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}
        >
          {d.kindLabel} of the {d.roleLabel}
        </Typography>
        {d.count !== undefined && d.count > 1 ? (
          <Typography
            sx={{
              fontFamily: SERIF,
              fontSize: fontSize(size, 0.85) + 'rem',
              fontWeight: 800,
            }}
          >
            №{d.count}
          </Typography>
        ) : null}
      </Box>

      {/* Body */}
      <Stack
        spacing={size === 'small' ? 0.4 : 0.75}
        sx={{ position: 'relative', px: 1, py: size === 'small' ? 0.5 : 0.75, flex: 1 }}
      >
        {(size === 'detailed' || size === 'page') ? (
          <>
            <Flourish />
            <Flourish flip />
          </>
        ) : null}

        <Typography
          sx={{
            fontFamily: SERIF,
            fontSize: fontSize(size, 1.15) + 'rem',
            fontWeight: 700,
            lineHeight: 1.1,
            textAlign: 'center',
            color: INK,
            textShadow: '0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          {d.title}
        </Typography>

        {size !== 'small' && d.subtitle ? (
          <Typography
            sx={{
              fontFamily: SERIF,
              fontSize: fontSize(size, 0.7) + 'rem',
              fontStyle: 'italic',
              color: INK_FAINT,
              textAlign: 'center',
              borderTop: `1px solid ${INK_FAINT}66`,
              borderBottom: `1px solid ${INK_FAINT}66`,
              py: 0.25,
            }}
          >
            {d.subtitle}
          </Typography>
        ) : null}

        {/* Stats */}
        {d.stats ? (
          <Stack
            direction="row"
            spacing={size === 'small' ? 0.25 : 0.75}
            sx={{ justifyContent: 'center', pt: size === 'small' ? 0.25 : 0.5 }}
          >
            {d.stats.map((s) => (
              <StatBox key={s.label} label={s.label} value={s.value} size={size} />
            ))}
          </Stack>
        ) : null}

        {/* Cost */}
        {d.cost && d.cost.bag.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {size === 'small'
              ? <Typography sx={{ fontSize: '0.6rem', color: INK_FAINT, fontStyle: 'italic' }}>{d.cost.short}</Typography>
              : d.cost.bag.map((b) => (
                  <Box
                    key={b.resource}
                    sx={{
                      px: 0.5,
                      py: 0.1,
                      border: `1px solid ${INK_FAINT}`,
                      bgcolor: 'rgba(255,255,255,0.4)',
                      fontSize: fontSize(size, 0.65) + 'rem',
                      letterSpacing: 0.4,
                    }}
                  >
                    {b.count} {b.resource}
                  </Box>
                ))}
          </Stack>
        ) : null}

        {/* Benefit */}
        {d.benefit && size !== 'small' ? (
          <Typography
            sx={{
              fontFamily: SERIF,
              fontSize: fontSize(size, 0.75) + 'rem',
              color: INK,
              textAlign: 'center',
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
                  py: 0.25,
                  border: `1px solid ${INK_FAINT}66`,
                  borderLeft: `4px solid`,
                  borderLeftColor: (t) =>
                    e.color
                      ? t.palette.eventColor[e.color].dark
                      : INK_FAINT,
                  bgcolor: e.emphasized ? 'rgba(255,250,235,0.7)' : 'transparent',
                }}
              >
                <Typography
                  sx={{
                    fontSize: fontSize(size, 0.55) + 'rem',
                    color: INK_FAINT,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    fontWeight: 700,
                  }}
                >
                  {e.label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: SERIF,
                    fontSize: fontSize(size, 0.75) + 'rem',
                    color: INK,
                    lineHeight: 1.35,
                  }}
                >
                  {e.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : null}

        {/* Flavor */}
        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              fontFamily: SERIF,
              mt: 'auto',
              pt: 1,
              fontStyle: 'italic',
              color: INK_FAINT,
              fontSize: '0.9rem',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            ❦ {d.flavor} ❦
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v2Parchment: Variation = {
  id: 'parchment',
  name: 'Parchment Vintage',
  blurb:
    'Cream paper, serif type, role banner across the top, boxed stat counters, SVG corner flourishes.',
  Renderer: ParchmentRenderer,
};
