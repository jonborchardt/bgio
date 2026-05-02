// V9CardShell — shared visual container for every typed card.
//
// Two design rules this file enforces:
//   1. **Fixed size.** Width AND height come from `CARD_WIDTH` /
//      `CARD_HEIGHT` for the requested `size`. Content that doesn't fit
//      clips. Cards behave like physical playing cards — no growing,
//      no shrinking with content.
//   2. **Inherit the game's look.** Typography uses MUI variants (no
//      custom font stacks), surfaces use `palette.card.surface`, and
//      role tints derive from the same `palette.role[role]` tokens the
//      rest of the UI consumes. The card sits inside the dark game
//      shell rather than visually announcing itself as a separate
//      design system.

import { Fragment } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from './sizes.ts';
import { CardInfoButton } from './CardInfoButton.tsx';
import { CardRefChip } from './CardRefChip.tsx';
import { KindGlyph } from './kindGlyphs.tsx';
import type { DisplayCard, DisplayRoleSection } from './cardDisplay.ts';
import type { Role } from '../../game/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { ResourceText } from '../resources/ResourceText.tsx';

const accent = (t: Theme, role: Role): string => t.palette.role[role].main;
const accentLight = (t: Theme, role: Role): string => t.palette.role[role].light;

const ROLE_LABEL_SHORT: Record<Role, string> = {
  chief: 'Chief',
  science: 'Science',
  domestic: 'Domestic',
  foreign: 'Foreign',
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      sx={(t) => ({
        alignItems: 'center',
        px: 0.6,
        py: 0.3,
        border: `1px solid ${t.palette.status.muted}66`,
        borderRadius: 0.5,
        bgcolor: 'rgba(255,255,255,0.04)',
        minWidth: 36,
      })}
    >
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 800, lineHeight: 1, color: 'text.primary' }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontWeight: 700,
          fontSize: '0.55rem',
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

type LineKind = 'building' | 'unit' | 'text';
interface RoleLine {
  label: string;
  text: string;
  kind: LineKind;
}

// Render the body of a section line. Buildings / units lines split on
// commas into `CardRefChip` elements (each with its own `?` button); the
// resources line walks the text for `<n> <resource>` references and
// substitutes a `ResourceToken` for each match (with the resource name on
// hover) so the only resource references on a card are icons.
const renderLineBody = (line: RoleLine, fontSize: string, size: CardSize) => {
  if (line.kind === 'text') {
    return (
      <Box
        component="span"
        sx={{
          color: 'text.primary',
          lineHeight: 1.2,
          fontSize,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.25,
          rowGap: 0.2,
          minWidth: 0,
        }}
      >
        <ResourceText text={line.text} size={size} />
      </Box>
    );
  }
  const refKind: 'building' | 'unit' = line.kind;
  const names = line.text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return (
    <>
      {names.map((n, i) => (
        <Fragment key={`${n}-${i}`}>
          {i > 0 ? (
            <Typography
              component="span"
              variant="caption"
              sx={{ color: 'text.secondary', fontSize, mx: 0.2 }}
            >
              ,
            </Typography>
          ) : null}
          <CardRefChip name={n} kind={refKind} fontSize={fontSize} />
        </Fragment>
      ))}
    </>
  );
};

/** Renders one tech role section. At `normal`/`detailed` size every
 *  section is a fixed-height quadrant tile (consumed by the 2×2 grid in
 *  the shell). */
function RoleSection({
  section,
  size,
}: {
  section: DisplayRoleSection;
  size: CardSize;
}) {
  const lines: RoleLine[] = [];
  if (section.buildings)
    lines.push({ label: 'Buildings', text: section.buildings, kind: 'building' });
  if (section.units)
    lines.push({ label: 'Units', text: section.units, kind: 'unit' });
  if (section.resources)
    lines.push({ label: 'Resources', text: section.resources, kind: 'text' });

  const compact = size === 'detailed' || size === 'normal';

  // Empty section. At `normal`/`detailed` we still render the quadrant so
  // the 2×2 grid stays visually balanced and the user can see "this role
  // gets nothing from this tech."
  if (lines.length === 0) {
    if (!compact) return null;
    return (
      <Box
        sx={(t) => ({
          borderLeft: `3px solid ${accent(t, section.role)}`,
          bgcolor: `${accent(t, section.role)}14`,
          borderRadius: '0 4px 4px 0',
          px: 0.5,
          py: 0.2,
          minHeight: 0,
          overflow: 'hidden',
        })}
      >
        <Typography
          variant="caption"
          sx={(t) => ({
            fontWeight: 800,
            color: accentLight(t, section.role),
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            lineHeight: 1.15,
            fontSize: '0.55rem',
            display: 'block',
          })}
        >
          {ROLE_LABEL_SHORT[section.role]}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.55rem',
            opacity: 0.6,
          }}
        >
          —
        </Typography>
      </Box>
    );
  }

  if (compact) {
    // Quadrant tile: header on top, each line below as
    // `LABEL: <body>` with the body truncated to a single line. The
    // tile clips overflow so a long resource event line doesn't
    // expand the row and push the third / fourth quadrants out of
    // the card.
    return (
      <Box
        sx={(t) => ({
          borderLeft: `3px solid ${accent(t, section.role)}`,
          bgcolor: `${accent(t, section.role)}1f`,
          borderRadius: '0 4px 4px 0',
          px: 0.5,
          py: 0.2,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        <Typography
          variant="caption"
          sx={(t) => ({
            fontWeight: 800,
            color: accentLight(t, section.role),
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            lineHeight: 1.15,
            fontSize: '0.55rem',
          })}
        >
          {ROLE_LABEL_SHORT[section.role]}
        </Typography>
        {lines.map((l) => (
          <Box
            key={l.label}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 0.3,
              minWidth: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            <Typography
              component="span"
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontWeight: 700,
                fontSize: '0.5rem',
                flexShrink: 0,
              }}
            >
              {l.label}
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.2,
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {renderLineBody(l, '0.6rem', size)}
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={(t) => ({
        borderLeft: `3px solid ${accent(t, section.role)}`,
        bgcolor: `${accent(t, section.role)}1f`,
        borderRadius: '0 4px 4px 0',
        px: 0.7,
        py: 0.3,
      })}
    >
      <Typography
        variant="caption"
        sx={(t) => ({
          fontWeight: 800,
          color: accentLight(t, section.role),
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          lineHeight: 1.1,
          fontSize: '0.6rem',
          display: 'block',
        })}
      >
        {ROLE_LABEL_SHORT[section.role]}
      </Typography>
      <Stack spacing={0.05}>
        {lines.map((l) => (
          <Stack
            key={l.label}
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap', rowGap: 0.2 }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontWeight: 700,
                fontSize: '0.55rem',
                minWidth: 60,
              }}
            >
              {l.label}
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.3,
                flexWrap: 'wrap',
                rowGap: 0.2,
              }}
            >
              {renderLineBody(l, '0.7rem', size)}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export interface V9CardShellProps {
  display: DisplayCard;
  size?: CardSize;
  cardId?: string;
  highlightSubId?: string;
}

export function V9CardShell({
  display: d,
  size = 'detailed',
  cardId,
  highlightSubId,
}: V9CardShellProps) {
  const w = CARD_WIDTH[size];
  const h = CARD_HEIGHT[size];
  const showFull = size === 'normal' || size === 'detailed';
  const showSomeLines = showFull;

  // Micro: single-line chip with kind glyph + title.
  if (size === 'micro') {
    return (
      <Paper
        elevation={0}
        sx={(t) => ({
          width: w,
          height: h,
          borderRadius: 0.5,
          border: `1px solid ${t.palette.status.muted}`,
          bgcolor: t.palette.card.surface,
          color: t.palette.card.text,
          px: 0.75,
          py: 0.25,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <Box sx={(t) => ({ color: accent(t, d.role) })}>
          <KindGlyph kind={d.kind} size={14} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {d.title}
        </Typography>
        {cardId !== undefined ? (
          <CardInfoButton
            cardId={cardId}
            size="micro"
            highlightSubId={highlightSubId}
          />
        ) : null}
      </Paper>
    );
  }

  const sigilDim = size === 'small' ? 22 : size === 'normal' ? 30 : 40;
  // At `small` size the card is only ~110×90 — anything past title +
  // cost spills off the frame. Hide unit stats, role-reward sections,
  // benefit text, and adjacency callouts; the small card is purely an
  // identifier (kind glyph + title + cost).
  const isCompactIdentifier = size === 'small';
  const sectionsToShow =
    d.roleSections && !isCompactIdentifier
      ? showFull
        ? d.roleSections
        : d.roleSections.filter((s) => s.role === d.role)
      : [];

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        // FIXED dimensions — physical card size for the chosen `size`.
        width: w,
        height: h,
        bgcolor: t.palette.card.surface,
        color: t.palette.card.text,
        border: `1px solid ${t.palette.status.muted}66`,
        borderRadius: 1,
        boxShadow: t.palette.shadow.card,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      })}
    >
      <Box sx={(t) => ({ height: 4, bgcolor: accent(t, d.role) })} />

      {cardId !== undefined ? (
        <CardInfoButton
          cardId={cardId}
          size={size}
          highlightSubId={highlightSubId}
        />
      ) : null}

      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: 'flex-start',
          px: size === 'small' ? 0.75 : 1,
          pt: size === 'small' ? 0.4 : 0.6,
        }}
      >
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={(t) => ({
              color: accent(t, d.role),
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              fontWeight: 800,
              lineHeight: 1.2,
              fontSize: '0.6rem',
            })}
          >
            {d.kindLabel} · {d.roleLabel}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -0.2,
              color: 'text.primary',
            }}
          >
            {d.title}
          </Typography>
          {showSomeLines && d.subtitle ? (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.2,
                fontSize: '0.65rem',
              }}
            >
              {d.subtitle}
            </Typography>
          ) : null}
        </Stack>
        <Box sx={(t) => ({ color: accent(t, d.role), flexShrink: 0 })}>
          <KindGlyph kind={d.kind} size={sigilDim} />
        </Box>
        {d.count !== undefined && d.count > 1 ? (
          <Box
            sx={(t) => ({
              alignSelf: 'flex-start',
              px: 0.5,
              py: 0.05,
              bgcolor: accent(t, d.role),
              color: t.palette.role[d.role].contrastText,
              fontWeight: 800,
              fontSize: '0.7rem',
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
          px: size === 'small' ? 0.75 : 1,
          py: size === 'small' ? 0.4 : 0.55,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Top group: stats + cost stay near the title. */}
        {d.stats && !isCompactIdentifier ? (
          <Stack direction="row" spacing={0.5}>
            {d.stats.map((s) => (
              <StatBox key={s.label} label={s.label} value={s.value} />
            ))}
          </Stack>
        ) : null}

        {d.cost && d.cost.bag.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.4}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.4 }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 800,
                fontSize: '0.55rem',
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

        {/* Spacer — pushes the reward block (benefit / sections / adjacency)
            down so the layout reads: title → cost → … → rewards-at-bottom. */}
        <Box sx={{ flex: 1, minHeight: 0 }} />

        {/* Bottom group: benefit / sections / adjacency / flavor. */}
        {!d.roleSections && d.benefit && showSomeLines ? (
          <Box
            sx={{
              color: 'text.primary',
              lineHeight: 1.35,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 0.3,
              rowGap: 0.2,
            }}
          >
            <ResourceText text={d.benefit} size={size} />
          </Box>
        ) : null}

        {d.adjacencies && d.adjacencies.length > 0 && showSomeLines ? (
          <Stack spacing={0.2}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 800,
                fontSize: '0.55rem',
              }}
            >
              Adjacency
            </Typography>
            {d.adjacencies.map((a, i) => {
              const isWildcard = a.neighbor === 'any building';
              return (
                <Stack
                  key={`${a.neighbor}-${i}`}
                  direction="row"
                  spacing={0.4}
                  sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.3 }}
                >
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: a.active ? 'text.primary' : 'text.secondary',
                      fontWeight: a.active ? 700 : 500,
                      fontSize: '0.65rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {a.active ? '✓' : '·'} next to{' '}
                    {isWildcard ? (
                      a.neighbor
                    ) : (
                      <CardRefChip
                        name={a.neighbor}
                        kind="building"
                        fontSize="0.65rem"
                      />
                    )}
                  </Typography>
                  {a.bonus.map((b) => (
                    <ResourceToken
                      key={b.resource}
                      resource={b.resource}
                      count={b.count}
                      size={size}
                    />
                  ))}
                </Stack>
              );
            })}
          </Stack>
        ) : null}

        {sectionsToShow.length > 0 ? (
          // Full-width vertical stack: each role section gets its own
          // row spanning the card width. Each tile clips its own
          // overflow, so a long event line in one role can't push the
          // siblings out of the frame.
          <Stack spacing={0.25}>
            {sectionsToShow.map((s) => (
              <RoleSection key={s.role} section={s} size={size} />
            ))}
          </Stack>
        ) : null}

      </Stack>
    </Paper>
  );
}

export default V9CardShell;
