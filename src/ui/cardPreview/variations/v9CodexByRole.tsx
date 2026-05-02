// Variation 9 — Codex II (by-role).
//
// Derived from v8 Codex but reorganises the tech body into per-role
// sections. Each section is a coloured panel for one of the four roles,
// listing whatever that role receives from the card:
//
//     [Domestic]   Buildings:  Barracks, Fight Circle
//                  Units:      —
//                  Resources:  1 wood
//
//     [Foreign]    Units:      Spearman, Stick Fighter, Shield Bearer
//                  Resources:  +1 attack this round
//
//     …etc for Science / Chief.
//
// No "For you" highlight, no "Other roles" section. Resource costs use
// small coloured tokens (number-on-coloured-square) — the colourless
// number-only chips from v8 are gone. Section panels carry a tinted
// background and a coloured left border so the reader can scan to the
// role they care about without reading a label.
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
const accentLight = (t: Theme, role: DisplayCard['role']): string =>
  t.palette.role[role].light;

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

// Small coloured token: number-on-coloured-square with a tiny resource
// initial. Designed to be ~14px at normal size so a row of 4 fits in
// any size. No standalone "1" chip; always paired visually with colour.
const ResourceToken = ({
  resource,
  count,
  size,
}: {
  resource: string;
  count: number;
  size: CardSize;
}) => {
  const dim = size === 'small' ? 14 : size === 'normal' ? 18 : size === 'detailed' ? 22 : 28;
  const initial = resource.charAt(0).toUpperCase();
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        width: dim,
        height: dim,
        borderRadius: 0.4,
        bgcolor: t.palette.resource[resource as 'gold'].main,
        border: `1px solid ${t.palette.resource[resource as 'gold'].dark}`,
        color: t.palette.resource[resource as 'gold'].contrastText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: dim * 0.55,
        lineHeight: 1,
      })}
      title={`${count} ${resource}`}
    >
      {count}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          bottom: -1,
          right: 1,
          fontSize: dim * 0.32,
          fontWeight: 700,
          opacity: 0.85,
        }}
      >
        {initial}
      </Box>
    </Box>
  );
};

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

interface RoleSectionProps {
  role: DisplayCard['role'];
  buildings?: string;
  units?: string;
  resources?: string;
  size: CardSize;
}

const RoleSection = ({
  role,
  buildings,
  units,
  resources,
  size,
}: RoleSectionProps) => {
  const lines: Array<{ label: string; text: string }> = [];
  if (buildings) lines.push({ label: 'Buildings', text: buildings });
  if (units) lines.push({ label: 'Units', text: units });
  if (resources) lines.push({ label: 'Resources', text: resources });
  if (lines.length === 0) return null;
  const ROLE_LABEL: Record<DisplayCard['role'], string> = {
    chief: 'Chief',
    science: 'Science',
    domestic: 'Domestic',
    foreign: 'Foreign',
  };
  return (
    <Box
      sx={(t) => ({
        borderLeft: `4px solid ${accent(t, role)}`,
        bgcolor: `${accentLight(t, role)}55`,
        borderRadius: '0 4px 4px 0',
        px: 0.7,
        py: 0.35,
      })}
    >
      <Typography
        sx={(t) => ({
          fontFamily: SANS,
          fontSize: fontScale(size, 0.6) + 'rem',
          fontWeight: 800,
          color: accentDark(t, role),
          textTransform: 'uppercase',
          letterSpacing: 1,
          lineHeight: 1.1,
          mb: 0.2,
        })}
      >
        {ROLE_LABEL[role]}
      </Typography>
      <Stack spacing={0.1}>
        {lines.map((l) => (
          <Stack
            key={l.label}
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'baseline' }}
          >
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.55) + 'rem',
                color: INK_FAINT,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 700,
                minWidth: 64,
              }}
            >
              {l.label}
            </Typography>
            <Typography
              sx={{
                fontFamily: SANS,
                fontSize: fontScale(size, 0.7) + 'rem',
                color: INK,
                lineHeight: 1.3,
                fontWeight: 600,
              }}
            >
              {l.text}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

const CodexByRoleRenderer: Renderer = ({ card, size }) => {
  const d = toDisplayCard(card);
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  const showFull = size === 'detailed' || size === 'page';
  const showSomeLines = size === 'normal' || showFull;
  const sigilDim =
    size === 'small' ? 22 : size === 'normal' ? 32 : size === 'detailed' ? 44 : 60;

  // For tech cards, fall back to roleSections (per-role view). At the
  // smaller `normal` size, show only the holder's role section so the
  // card stays scannable; show all four at detailed/page.
  const roleSections = d.roleSections ?? [];
  const sectionsToShow = showFull
    ? roleSections
    : roleSections.filter((s) => s.role === d.role);

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
      <Box sx={(t) => ({ height: 5, bgcolor: accent(t, d.role) })} />

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

      <Stack
        spacing={size === 'small' ? 0.35 : 0.55}
        sx={{
          px: size === 'small' ? 0.75 : 1.1,
          py: size === 'small' ? 0.4 : 0.65,
          flex: 1,
        }}
      >
        {/* Stats — boxed counters (units only) */}
        {d.stats ? (
          <Stack direction="row" spacing={size === 'small' ? 0.3 : 0.5}>
            {d.stats.map((s) => (
              <StatBox
                key={s.label}
                label={s.label}
                value={s.value}
                size={size}
              />
            ))}
          </Stack>
        ) : null}

        {/* Cost — small coloured tokens */}
        {d.cost && d.cost.bag.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.4}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.4 }}
          >
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
              <ResourceToken
                key={b.resource}
                resource={b.resource}
                count={b.count}
                size={size}
              />
            ))}
          </Stack>
        ) : null}

        {/* Benefit (non-tech cards) */}
        {!d.roleSections && d.benefit && showSomeLines ? (
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

        {/* Per-role sections (tech cards) */}
        {sectionsToShow.length > 0 ? (
          <Stack spacing={0.35}>
            {sectionsToShow.map((s) => (
              <RoleSection
                key={s.role}
                role={s.role}
                buildings={s.buildings}
                units={s.units}
                resources={s.resources}
                size={size}
              />
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

export const v9CodexByRole: Variation = {
  id: 'codexByRole',
  name: 'Codex II — by role',
  blurb:
    'Codex layout, but the body is grouped into per-role panels (Chief / Science / Domestic / Foreign), each listing buildings / units / resources for that role. Coloured panel backgrounds + left borders. Smaller coloured resource tokens replace the chip + label pairs.',
  Renderer: CodexByRoleRenderer,
};
