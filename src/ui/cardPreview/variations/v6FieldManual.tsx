// Variation 6 — Field Manual.
//
// Synthesises the user's wins:
//   • Light cream surface (parchment hue without dated serifs)
//   • Sans-serif typography, modern but warm
//   • Per-kind SVG glyph (unique per card kind, not per role)
//   • Role-coloured "For you" block for the holder + role-coloured
//     left-border blocks for the other three roles' event lines
//     (every line visible at detailed/page — no missing data)
//   • Role-coloured "Grants → Buildings (domestic)" / "Grants → Units
//     (foreign)" lines
//   • Coloured resource pills (no white-on-paper text)
//   • Boxed ATK/DEF/INI stat counters
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import { KindGlyph } from '../kindGlyphs.tsx';
import type { Renderer, Variation } from '../types.ts';

const PAPER = '#fbf6ec';
const PAPER_EDGE = '#e8dfc9';
const INK = '#1f1a14';
const INK_FAINT = '#6e5f47';
const SANS = '"Inter", "Segoe UI", system-ui, sans-serif';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;

const accentDark = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].dark;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.78,
    normal: 1,
    detailed: 1.12,
    page: 1.4,
  };
  return base * k[size];
};

const ResourcePill = ({
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
    spacing={0.4}
    sx={{ alignItems: 'center' }}
  >
    <Box
      sx={(t) => ({
        bgcolor: t.palette.resource[resource as 'gold'].main,
        color: t.palette.resource[resource as 'gold'].contrastText,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: fontScale(size, 0.7) + 'rem',
        px: 0.6,
        py: 0.05,
        borderRadius: '999px',
        lineHeight: 1.3,
        border: `1px solid ${t.palette.resource[resource as 'gold'].dark}`,
      })}
    >
      {count}
    </Box>
    {size !== 'small' ? (
      <Typography
        sx={{
          fontFamily: SANS,
          fontSize: fontScale(size, 0.6) + 'rem',
          color: INK_FAINT,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
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
      bgcolor: 'rgba(255,255,255,0.55)',
      minWidth: size === 'small' ? 22 : 34,
    }}
  >
    <Typography
      sx={{
        fontFamily: SANS,
        fontSize: fontScale(size, 1) + 'rem',
        fontWeight: 800,
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
      }}
    >
      {label}
    </Typography>
  </Stack>
);

const FieldManualRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  const showFull = size === 'detailed' || size === 'page';
  const showSomeLines = size === 'normal' || showFull;

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        bgcolor: PAPER,
        color: INK,
        fontFamily: SANS,
        border: `1px solid ${PAPER_EDGE}`,
        borderRadius: 1,
        boxShadow: '0 1px 2px rgba(31,26,20,0.18)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar — role colour + kind glyph */}
      <Stack
        direction="row"
        spacing={size === 'small' ? 0.5 : 0.75}
        sx={(t) => ({
          alignItems: 'center',
          px: size === 'small' ? 0.75 : 1.1,
          py: size === 'small' ? 0.4 : 0.55,
          borderBottom: `2px solid ${accent(t, d.role)}`,
          bgcolor: `${accent(t, d.role)}1a`,
        })}
      >
        <Box sx={(t) => ({ color: accentDark(t, d.role) })}>
          <KindGlyph kind={d.kind} size={size === 'small' ? 18 : size === 'page' ? 28 : 22} />
        </Box>
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={(t) => ({
              fontFamily: SANS,
              fontSize: fontScale(size, 0.55) + 'rem',
              color: accentDark(t, d.role),
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontWeight: 700,
              lineHeight: 1.2,
            })}
          >
            {d.kindLabel} · {d.roleLabel}
          </Typography>
          <Typography
            sx={{
              fontFamily: SANS,
              fontSize: fontScale(size, 1.05) + 'rem',
              fontWeight: 800,
              lineHeight: 1.05,
              color: INK,
            }}
          >
            {d.title}
          </Typography>
        </Stack>
        {d.count !== undefined && d.count > 1 ? (
          <Box
            sx={(t) => ({
              px: 0.6,
              py: 0.1,
              bgcolor: accentDark(t, d.role),
              color: '#fff',
              fontWeight: 800,
              fontSize: fontScale(size, 0.75) + 'rem',
              borderRadius: 0.5,
            })}
          >
            ×{d.count}
          </Box>
        ) : null}
      </Stack>

      {/* Body */}
      <Stack
        spacing={size === 'small' ? 0.4 : 0.6}
        sx={{
          px: size === 'small' ? 0.75 : 1.1,
          py: size === 'small' ? 0.5 : 0.7,
          flex: 1,
        }}
      >
        {showSomeLines && d.subtitle ? (
          <Typography
            sx={{
              fontSize: fontScale(size, 0.65) + 'rem',
              color: INK_FAINT,
              lineHeight: 1.2,
            }}
          >
            {d.subtitle}
          </Typography>
        ) : null}

        {/* Stats — boxed counters */}
        {d.stats ? (
          <Stack
            direction="row"
            spacing={size === 'small' ? 0.3 : 0.5}
          >
            {d.stats.map((s) => (
              <StatBox key={s.label} label={s.label} value={s.value} size={size} />
            ))}
          </Stack>
        ) : null}

        {/* Cost — coloured pills */}
        {d.cost && d.cost.bag.length > 0 ? (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography
              sx={{
                fontSize: fontScale(size, 0.55) + 'rem',
                color: INK_FAINT,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 700,
                alignSelf: 'center',
                mr: 0.25,
              }}
            >
              Cost
            </Typography>
            {d.cost.bag.map((b) => (
              <ResourcePill
                key={b.resource}
                resource={b.resource}
                count={b.count}
                size={size}
              />
            ))}
          </Stack>
        ) : null}

        {/* Benefit (basic — buildings/units have a single string) */}
        {!d.grants && d.benefit && showSomeLines ? (
          <Typography
            sx={{
              fontSize: fontScale(size, 0.75) + 'rem',
              color: INK,
              lineHeight: 1.35,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Grants — role-coloured (Buildings → green, Units → red) */}
        {d.grants && showSomeLines ? (
          <Stack spacing={0.3}>
            {d.grants.map((g) => (
              <Stack
                key={g.label}
                direction="row"
                spacing={0.5}
                sx={(t) => ({
                  px: 0.6,
                  py: 0.25,
                  borderLeft: `4px solid ${accent(t, g.role)}`,
                  bgcolor: `${accent(t, g.role)}14`,
                  borderRadius: '0 4px 4px 0',
                })}
              >
                <Typography
                  sx={(t) => ({
                    fontSize: fontScale(size, 0.6) + 'rem',
                    fontWeight: 800,
                    color: accentDark(t, g.role),
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    minWidth: 64,
                  })}
                >
                  Grants {g.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: fontScale(size, 0.7) + 'rem',
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

        {/* Effects — every event line at detailed/page; first line at normal */}
        {d.effects ? (
          <Stack spacing={0.3}>
            {(showFull ? d.effects : d.effects.slice(0, 1)).map((e) => (
              <Stack
                key={e.label}
                direction="row"
                spacing={0.75}
                sx={(t) => ({
                  pl: 0.75,
                  pr: 0.5,
                  py: 0.3,
                  borderLeft: `4px solid ${
                    e.color
                      ? t.palette.eventColor[e.color].main
                      : t.palette.status.muted
                  }`,
                  bgcolor: e.emphasized
                    ? `${
                        e.color
                          ? t.palette.eventColor[e.color].main
                          : INK_FAINT
                      }1f`
                    : 'transparent',
                  alignItems: 'baseline',
                })}
              >
                <Typography
                  sx={(t) => ({
                    fontSize: fontScale(size, 0.55) + 'rem',
                    fontWeight: 800,
                    color: e.color
                      ? t.palette.eventColor[e.color].dark
                      : INK_FAINT,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    minWidth: 64,
                  })}
                >
                  {e.emphasized ? `For you · ${e.label}` : e.label}
                </Typography>
                <Typography
                  sx={{
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

        {/* Flavor (page only) */}
        {size === 'page' && d.flavor ? (
          <Typography
            sx={{
              mt: 'auto',
              pt: 1,
              borderTop: `1px solid ${INK_FAINT}33`,
              fontSize: '0.85rem',
              fontStyle: 'italic',
              color: INK_FAINT,
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

export const v6FieldManual: Variation = {
  id: 'fieldManual',
  name: 'Field Manual',
  blurb:
    'Cream surface, modern sans-serif, role header bar with kind SVG, role-coloured Grants + per-event-color blocks, coloured resource pills, boxed ATK/DEF/INI.',
  Renderer: FieldManualRenderer,
};
