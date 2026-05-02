// Variation 8 — Codex.
//
// Light slate paper, strong typographic hierarchy, role-coloured
// category strip across the very top. The kind SVG sits as a sigil in
// the top-right corner. Two-section layout below: a "For you" panel
// (holder's coloured event line) and an "Other roles" panel listing
// the remaining three event lines, each tagged with its role label and
// colour. Grants surface as their own role-coloured rows: "→ Domestic
// gets:" and "→ Foreign gets:". Coloured square resource chips. Boxed
// stats. No missing data at any size.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import { KindGlyph } from '../kindGlyphs.tsx';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#f5f3ee';
const PAPER_EDGE = '#cfc9bd';
const INK = '#0e1116';
const INK_FAINT = '#5e6470';
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif';
const DISPLAY = '"Fraunces", "Iowan Old Style", Georgia, serif';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;
const accentDark = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].dark;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.75,
    normal: 1,
    detailed: 1.12,
    page: 1.42,
  };
  return base * k[size];
};

const ResourceChip = ({
  resource,
  count,
  size,
}: {
  resource: string;
  count: number;
  size: CardSize;
}) => (
  <Stack
    direction="row"
    spacing={0.3}
    sx={{ alignItems: 'center' }}
  >
    <Box
      sx={(t) => ({
        bgcolor: t.palette.resource[resource as 'gold'].main,
        color: t.palette.resource[resource as 'gold'].contrastText,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: fontScale(size, 0.7) + 'rem',
        width: fontScale(size, 18) + 'px',
        height: fontScale(size, 18) + 'px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 0.5,
        border: `1px solid ${t.palette.resource[resource as 'gold'].dark}`,
        lineHeight: 1,
      })}
    >
      {count}
    </Box>
    {size !== 'small' ? (
      <Typography
        sx={(t) => ({
          fontFamily: SANS,
          fontSize: fontScale(size, 0.6) + 'rem',
          color: t.palette.resource[resource as 'gold'].dark,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontWeight: 700,
        })}
      >
        {resource}
      </Typography>
    ) : null}
  </Stack>
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
      px: size === 'small' ? 0.3 : 0.6,
      py: size === 'small' ? 0.15 : 0.3,
      border: `1px solid ${INK}`,
      bgcolor: '#fff',
      minWidth: size === 'small' ? 22 : 34,
    }}
  >
    <Typography
      sx={{
        fontFamily: DISPLAY,
        fontSize: fontScale(size, 1.05) + 'rem',
        fontWeight: 700,
        color: INK,
        lineHeight: 1,
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontFamily: SANS,
        fontSize: fontScale(size, 0.5) + 'rem',
        color: INK_FAINT,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: 700,
      }}
    >
      {label}
    </Typography>
  </Stack>
);

const CodexRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  const showFull = size === 'detailed' || size === 'page';
  const showSomeLines = size === 'normal' || showFull;
  const sigilDim = size === 'small' ? 22 : size === 'normal' ? 32 : size === 'detailed' ? 44 : 60;

  // Split effects into "for you" (emphasized) and the rest.
  const myEffect = d.effects?.find((e) => e.emphasized);
  const otherEffects = d.effects?.filter((e) => !e.emphasized) ?? [];

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        bgcolor: PAPER,
        color: INK,
        fontFamily: SANS,
        border: `1px solid ${PAPER_EDGE}`,
        borderRadius: 0.5,
        boxShadow: '0 2px 4px rgba(14,17,22,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Top role strip */}
      <Box
        sx={(t) => ({
          height: 5,
          bgcolor: accent(t, d.role),
        })}
      />

      {/* Header — title + sigil */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'flex-start',
          px: size === 'small' ? 0.75 : 1.1,
          pt: size === 'small' ? 0.4 : 0.65,
        }}
      >
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={(t) => ({
              fontFamily: SANS,
              fontSize: fontScale(size, 0.55) + 'rem',
              color: accentDark(t, d.role),
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              fontWeight: 800,
              lineHeight: 1.2,
            })}
          >
            {d.kindLabel} · {d.roleLabel}
          </Typography>
          <Typography
            sx={{
              fontFamily: DISPLAY,
              fontSize: fontScale(size, 1.2) + 'rem',
              fontWeight: 700,
              lineHeight: 1.05,
              color: INK,
              letterSpacing: -0.3,
            }}
          >
            {d.title}
          </Typography>
          {showSomeLines && d.subtitle ? (
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.65) + 'rem',
                color: INK_FAINT,
                lineHeight: 1.25,
              }}
            >
              {d.subtitle}
            </Typography>
          ) : null}
        </Stack>
        <Box sx={(t) => ({ color: accentDark(t, d.role), flexShrink: 0 })}>
          <KindGlyph kind={d.kind} size={sigilDim} filled />
        </Box>
        {d.count !== undefined && d.count > 1 ? (
          <Box
            sx={(t) => ({
              alignSelf: 'flex-start',
              px: 0.5,
              py: 0.05,
              bgcolor: accentDark(t, d.role),
              color: '#fff',
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: fontScale(size, 0.7) + 'rem',
              borderRadius: 0.5,
              ml: -0.5,
            })}
          >
            ×{d.count}
          </Box>
        ) : null}
      </Stack>

      {/* Body */}
      <Stack
        spacing={size === 'small' ? 0.35 : 0.55}
        sx={{
          px: size === 'small' ? 0.75 : 1.1,
          py: size === 'small' ? 0.4 : 0.65,
          flex: 1,
        }}
      >
        {d.stats ? (
          <Stack direction="row" spacing={size === 'small' ? 0.3 : 0.5}>
            {d.stats.map((s) => (
              <StatBox key={s.label} label={s.label} value={s.value} size={size} />
            ))}
          </Stack>
        ) : null}

        {d.cost && d.cost.bag.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.4 }}>
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.55) + 'rem',
                color: INK_FAINT,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 800,
                mr: 0.25,
              }}
            >
              Cost
            </Typography>
            {d.cost.bag.map((b) => (
              <ResourceChip
                key={b.resource}
                resource={b.resource}
                count={b.count}
                size={size}
              />
            ))}
          </Stack>
        ) : null}

        {/* Benefit (basic cards) */}
        {!d.grants && d.benefit && showSomeLines ? (
          <Typography
            sx={{
              fontFamily: SANS,
              fontSize: fontScale(size, 0.78) + 'rem',
              color: INK,
              lineHeight: 1.4,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Grants → role-tagged rows */}
        {d.grants && showSomeLines ? (
          <Stack spacing={0.3}>
            {d.grants.map((g) => (
              <Stack
                key={g.label}
                direction="row"
                spacing={0.5}
                sx={(t) => ({
                  alignItems: 'baseline',
                  borderTop: `2px solid ${accent(t, g.role)}`,
                  pt: 0.3,
                })}
              >
                <Typography
                  sx={(t) => ({
                    fontFamily: SANS,
                    fontSize: fontScale(size, 0.6) + 'rem',
                    color: accentDark(t, g.role),
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    fontWeight: 800,
                    minWidth: 78,
                  })}
                >
                  → {g.role === 'domestic' ? 'Domestic' : 'Foreign'} gets
                </Typography>
                <Typography
                  sx={{
                    fontFamily: SANS,
                    fontSize: fontScale(size, 0.72) + 'rem',
                    color: INK,
                    lineHeight: 1.3,
                    fontWeight: 600,
                  }}
                >
                  {g.items}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {/* For-you panel */}
        {myEffect && showSomeLines ? (
          <Box
            sx={(t) => ({
              border: `2px solid ${
                myEffect.color
                  ? t.palette.eventColor[myEffect.color].main
                  : accent(t, d.role)
              }`,
              bgcolor: `${
                myEffect.color
                  ? t.palette.eventColor[myEffect.color].light
                  : accent(t, d.role)
              }22`,
              px: 0.75,
              py: 0.4,
              borderRadius: 0.5,
            })}
          >
            <Typography
              sx={(t) => ({
                fontFamily: SANS,
                fontSize: fontScale(size, 0.55) + 'rem',
                color: myEffect.color
                  ? t.palette.eventColor[myEffect.color].dark
                  : accentDark(t, d.role),
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 800,
              })}
            >
              For you · {myEffect.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.78) + 'rem',
                color: INK,
                lineHeight: 1.3,
              }}
            >
              {myEffect.text}
            </Typography>
          </Box>
        ) : null}

        {/* Other roles' event lines */}
        {otherEffects.length > 0 && showFull ? (
          <Stack spacing={0.2} sx={{ pt: 0.25 }}>
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.55) + 'rem',
                color: INK_FAINT,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontWeight: 800,
              }}
            >
              Other roles
            </Typography>
            {otherEffects.map((e) => (
              <Stack
                key={e.label}
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'baseline' }}
              >
                <Box
                  aria-hidden
                  sx={(t) => ({
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    mt: 0.5,
                    bgcolor: e.color
                      ? t.palette.eventColor[e.color].main
                      : INK_FAINT,
                  })}
                />
                <Typography
                  sx={(t) => ({
                    fontFamily: SANS,
                    fontSize: fontScale(size, 0.6) + 'rem',
                    fontWeight: 800,
                    color: e.color
                      ? t.palette.eventColor[e.color].dark
                      : INK_FAINT,
                    minWidth: 60,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  })}
                >
                  {e.label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: SANS,
                    fontSize: fontScale(size, 0.7) + 'rem',
                    color: INK,
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
              fontFamily: DISPLAY,
              fontSize: '0.95rem',
              fontStyle: 'italic',
              color: INK_FAINT,
              lineHeight: 1.5,
              borderTop: `1px solid ${PAPER_EDGE}`,
            }}
          >
            {d.flavor}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v8Codex: Variation = {
  id: 'codex',
  name: 'Codex',
  blurb:
    'Light paper, serif title + sans body, role strip on top, kind sigil top-right, role-tagged Grants rows, "For you" panel + "Other roles" list with role-coloured dots and labels.',
  Renderer: CodexRenderer,
};
