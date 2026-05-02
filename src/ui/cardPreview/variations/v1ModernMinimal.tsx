// Variation 1 — Crisp Modern.
//
// Light card surfaces, lots of whitespace, a single bold role-colored
// stripe down the left edge, big bold numerals, small uppercased labels.
// The look is "modern boardgame app" — flat, high contrast, no clutter.
// Each card shrinks gracefully across small / normal / detailed / page.
//
// This variation is self-contained: delete this file to remove it.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#f8fafc'; // off-white card surface
const TEXT = '#0f172a'; // near-black primary text
const MUTED = '#64748b';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;

const scaledFont = (size: CardSize, base: number, mult = 1): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.8,
    normal: 1,
    detailed: 1.15,
    page: 1.4,
  };
  return base * k[size] * mult;
};

const ResourceDot = ({
  resource,
  count,
  size,
}: {
  resource: string;
  count: number;
  size: CardSize;
}) => {
  const dim = size === 'small' ? 14 : size === 'page' ? 22 : 18;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box
        aria-hidden
        sx={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          bgcolor: (t) => t.palette.resource[resource as 'gold'].main,
          color: (t) => t.palette.resource[resource as 'gold'].contrastText,
          fontWeight: 800,
          fontSize: dim * 0.55,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {count}
      </Box>
      <Typography
        sx={{
          fontSize: scaledFont(size, 0.6, 1) + 'rem',
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {resource}
      </Typography>
    </Stack>
  );
};

const ModernMinimalRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        bgcolor: PAPER,
        color: TEXT,
        borderRadius: 1,
        boxShadow: '0 2px 8px rgba(15,23,42,0.18)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // Strong left stripe coloured by role.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 6,
          bgcolor: (t) => accent(t, d.role),
        },
      }}
    >
      <Stack
        spacing={size === 'small' ? 0.25 : 0.75}
        sx={{
          pl: size === 'small' ? 1 : 1.75,
          pr: size === 'small' ? 0.75 : 1.25,
          py: size === 'small' ? 0.5 : 1,
          flex: 1,
        }}
      >
        {/* Header: kind label + count */}
        <Stack
          direction="row"
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography
            sx={{
              fontSize: scaledFont(size, 0.55, 1) + 'rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: (t) => accent(t, d.role),
            }}
          >
            {d.kindLabel} · {d.roleLabel}
          </Typography>
          {d.count !== undefined && d.count > 1 ? (
            <Typography
              sx={{
                fontSize: scaledFont(size, 0.7) + 'rem',
                fontWeight: 800,
                color: TEXT,
              }}
            >
              ×{d.count}
            </Typography>
          ) : null}
        </Stack>

        {/* Title */}
        <Typography
          sx={{
            fontSize: scaledFont(size, 1, 1) + 'rem',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -0.2,
          }}
        >
          {d.title}
        </Typography>

        {size !== 'small' && d.subtitle ? (
          <Typography
            sx={{
              fontSize: scaledFont(size, 0.65) + 'rem',
              color: MUTED,
              lineHeight: 1.25,
            }}
          >
            {d.subtitle}
          </Typography>
        ) : null}

        {/* Stats (units) */}
        {d.stats && size !== 'small' ? (
          <Stack direction="row" spacing={1.5} sx={{ pt: 0.25 }}>
            {d.stats.map((s) => (
              <Stack key={s.label} sx={{ alignItems: 'center' }}>
                <Typography
                  sx={{
                    fontSize: scaledFont(size, 1.1) + 'rem',
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: scaledFont(size, 0.5) + 'rem',
                    color: MUTED,
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

        {/* Stats (small) */}
        {d.stats && size === 'small' ? (
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: TEXT,
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            {d.stats.map((s) => `${s.label[0]}${s.value}`).join(' ')}
          </Typography>
        ) : null}

        {/* Cost */}
        {d.cost && d.cost.bag.length > 0 ? (
          size === 'small' ? (
            <Typography
              sx={{
                fontSize: '0.6rem',
                color: (t) => t.palette.resource.gold.dark,
                fontWeight: 700,
              }}
            >
              {d.cost.short}
            </Typography>
          ) : (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ flexWrap: 'wrap', rowGap: 0.5, pt: 0.25 }}
            >
              {d.cost.bag.map((b) => (
                <ResourceDot
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
              fontSize: scaledFont(size, 0.7) + 'rem',
              color: TEXT,
              lineHeight: 1.35,
              pt: 0.25,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Effects (techs) */}
        {d.effects && (size === 'detailed' || size === 'page') ? (
          <Stack spacing={0.5} sx={{ pt: 0.5 }}>
            {d.effects.map((e) => (
              <Stack
                key={e.label}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'baseline',
                  pl: 0.75,
                  borderLeft: '3px solid',
                  borderColor: (t) =>
                    e.color
                      ? t.palette.eventColor[e.color].main
                      : t.palette.status.muted,
                  bgcolor: e.emphasized
                    ? 'rgba(15,23,42,0.04)'
                    : 'transparent',
                  py: 0.25,
                }}
              >
                <Typography
                  sx={{
                    fontSize: scaledFont(size, 0.55) + 'rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: (t) =>
                      e.color
                        ? t.palette.eventColor[e.color].dark
                        : MUTED,
                    minWidth: 60,
                  }}
                >
                  {e.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: scaledFont(size, 0.7) + 'rem',
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

        {/* Flavor (page only) */}
        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              mt: 'auto',
              pt: 1,
              fontStyle: 'italic',
              color: MUTED,
              fontSize: '0.85rem',
              lineHeight: 1.45,
              borderTop: `1px solid ${MUTED}33`,
            }}
          >
            “{d.flavor}”
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v1ModernMinimal: Variation = {
  id: 'modern',
  name: 'Crisp Modern',
  blurb:
    'Light surfaces, role-coloured left stripe, large bold titles, big resource dots.',
  Renderer: ModernMinimalRenderer,
};
