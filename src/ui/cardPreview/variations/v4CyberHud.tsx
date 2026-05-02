// Variation 4 — Cyber HUD.
//
// Sci-fi terminal aesthetic: dark slate field, neon role-coloured glow,
// SVG-clipped angled corners, monospace digits, subtle scanline texture.
// Stats look like a HUD readout; the title is uppercased with letter-
// spacing.
//
// Self-contained: delete this file to remove the variation.

import { Box, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from '../../cards/sizes.ts';
import { toDisplayCard, type DisplayCard } from '../displayCard.ts';
import type { Renderer, Variation } from '../types.ts';

const SLATE = '#070b13';
const SLATE_PANEL = '#0f1828';
const TEXT = '#d8efff';
const MUTED = '#5b7ba0';
const MONO = '"JetBrains Mono", "Fira Code", "Consolas", monospace';

const accent = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].main;

const fontScale = (size: CardSize, base: number): number => {
  const k: Record<CardSize, number> = {
    micro: 0.65,
    small: 0.75,
    normal: 1,
    detailed: 1.15,
    page: 1.4,
  };
  return base * k[size];
};

// SVG corner notches drawn over a clipped box. Renders as four little
// L-shapes positioned at each corner — the visual signature of a HUD
// frame.
const Brackets = ({ color }: { color: string }) => (
  <Box
    aria-hidden
    sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <svg width="100%" height="100%" preserveAspectRatio="none">
      <g stroke={color} strokeWidth="1.5" fill="none">
        {/* TL */}
        <polyline points="0,12 0,0 12,0" />
        {/* TR */}
        <polyline points="100%,12 100%,0 calc(100% - 12),0" />
        {/* BL */}
        <polyline points="0,calc(100% - 12) 0,100% 12,100%" />
        {/* BR */}
        <polyline points="calc(100% - 12),100% 100%,100% 100%,calc(100% - 12)" />
      </g>
    </svg>
  </Box>
);

const StatHud = ({
  label,
  value,
  size,
  color,
}: {
  label: string;
  value: string;
  size: CardSize;
  color: string;
}) => (
  <Stack
    sx={{
      alignItems: 'center',
      px: size === 'small' ? 0.25 : 0.5,
      py: size === 'small' ? 0.1 : 0.2,
      bgcolor: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}55`,
      minWidth: size === 'small' ? 24 : 36,
    }}
  >
    <Typography
      sx={{
        fontFamily: MONO,
        fontSize: fontScale(size, 1.05) + 'rem',
        fontWeight: 700,
        color,
        lineHeight: 1,
        textShadow: `0 0 6px ${color}`,
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontFamily: MONO,
        fontSize: fontScale(size, 0.5) + 'rem',
        color: MUTED,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Typography>
  </Stack>
);

const CyberRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];

  return (
    <Box
      sx={{
        width: w,
        minHeight: h,
        position: 'relative',
        color: TEXT,
        bgcolor: SLATE,
        backgroundImage: `repeating-linear-gradient(0deg, ${SLATE_PANEL} 0px, ${SLATE_PANEL} 1px, transparent 1px, transparent 3px)`,
        // Angled clip — beveled top-right and bottom-left corners.
        clipPath:
          'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
        boxShadow: (t) =>
          `0 0 0 1px ${accent(t, d.role)}88, 0 0 18px ${accent(t, d.role)}55`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        aria-hidden
        sx={(t) => ({
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          // Outer accent glow line
          boxShadow: `inset 0 0 0 1px ${accent(t, d.role)}`,
        })}
      />
      {(size === 'detailed' || size === 'page') ? (
        // Brackets only render at sizes where they have room; absolute
        // positioning is computed off the inner box edges.
        <Box
          aria-hidden
          sx={(t) => ({
            position: 'absolute',
            inset: 4,
            color: accent(t, d.role),
          })}
        >
          <Brackets color="currentColor" />
        </Box>
      ) : null}

      <Stack
        spacing={size === 'small' ? 0.25 : 0.5}
        sx={{
          position: 'relative',
          px: size === 'small' ? 0.75 : 1.25,
          py: size === 'small' ? 0.5 : 0.75,
          flex: 1,
        }}
      >
        {/* Header line: kind / role tag */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography
            sx={(t) => ({
              fontFamily: MONO,
              fontSize: fontScale(size, 0.55) + 'rem',
              color: accent(t, d.role),
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            })}
          >
            {`>${d.roleLabel.toUpperCase()}::${d.kindLabel.toUpperCase()}`}
          </Typography>
          {d.count !== undefined && d.count > 1 ? (
            <Typography
              sx={(t) => ({
                fontFamily: MONO,
                fontSize: fontScale(size, 0.7) + 'rem',
                color: accent(t, d.role),
                fontWeight: 800,
              })}
            >
              ×{d.count.toString().padStart(2, '0')}
            </Typography>
          ) : null}
        </Stack>

        {/* Title */}
        <Typography
          sx={(t) => ({
            fontFamily: MONO,
            fontSize: fontScale(size, 1.1) + 'rem',
            fontWeight: 800,
            lineHeight: 1.05,
            color: TEXT,
            textTransform: 'uppercase',
            letterSpacing: 1,
            textShadow: `0 0 10px ${accent(t, d.role)}77`,
          })}
        >
          {d.title}
        </Typography>

        {size !== 'small' && d.subtitle ? (
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: fontScale(size, 0.6) + 'rem',
              color: MUTED,
              letterSpacing: 0.6,
            }}
          >
            // {d.subtitle}
          </Typography>
        ) : null}

        {/* Stats */}
        {d.stats && size !== 'small' ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={(t) => ({
              pt: 0.25,
              color: accent(t, d.role),
            })}
          >
            {d.stats.map((s) => (
              <StatHud
                key={s.label}
                label={s.label}
                value={s.value}
                size={size}
                color="currentColor"
              />
            ))}
          </Stack>
        ) : null}
        {d.stats && size === 'small' ? (
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.6rem',
              color: TEXT,
              letterSpacing: 0.4,
            }}
          >
            {d.stats.map((s) => `${s.label[0]}:${s.value}`).join(' ')}
          </Typography>
        ) : null}

        {/* Cost row */}
        {d.cost && d.cost.bag.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            {size === 'small' ? (
              <Typography
                sx={(t) => ({
                  fontFamily: MONO,
                  fontSize: '0.6rem',
                  color: accent(t, d.role),
                })}
              >
                COST {d.cost.short.toUpperCase()}
              </Typography>
            ) : (
              d.cost.bag.map((b) => (
                <Box
                  key={b.resource}
                  sx={(t) => ({
                    fontFamily: MONO,
                    fontSize: fontScale(size, 0.6) + 'rem',
                    color: accent(t, d.role),
                    border: `1px solid ${accent(t, d.role)}88`,
                    bgcolor: 'rgba(0,0,0,0.4)',
                    px: 0.5,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  })}
                >
                  {b.count.toString().padStart(2, '0')} {b.resource}
                </Box>
              ))
            )}
          </Stack>
        ) : null}

        {/* Benefit */}
        {d.benefit && size !== 'small' ? (
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: fontScale(size, 0.7) + 'rem',
              color: TEXT,
              lineHeight: 1.4,
              borderLeft: `2px solid ${MUTED}`,
              pl: 0.75,
            }}
          >
            {d.benefit}
          </Typography>
        ) : null}

        {/* Effects */}
        {d.effects && (size === 'detailed' || size === 'page') ? (
          <Stack spacing={0.4}>
            {d.effects.map((e) => (
              <Stack
                key={e.label}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'baseline' }}
              >
                <Typography
                  sx={{
                    fontFamily: MONO,
                    fontSize: fontScale(size, 0.55) + 'rem',
                    color: (t) =>
                      e.color
                        ? t.palette.eventColor[e.color].main
                        : MUTED,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    minWidth: 64,
                    textShadow: e.emphasized
                      ? '0 0 6px currentColor'
                      : 'none',
                  }}
                >
                  [{e.label}]
                </Typography>
                <Typography
                  sx={{
                    fontFamily: MONO,
                    fontSize: fontScale(size, 0.65) + 'rem',
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
              fontFamily: MONO,
              fontSize: '0.75rem',
              color: MUTED,
              letterSpacing: 0.6,
              borderTop: `1px dashed ${MUTED}`,
              lineHeight: 1.5,
            }}
          >
            // {d.flavor}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const v4CyberHud: Variation = {
  id: 'cyber',
  name: 'Cyber HUD',
  blurb:
    'Sci-fi terminal: angled SVG corners, neon role glow, monospace digits, scanline texture, bracketed labels.',
  Renderer: CyberRenderer,
};
