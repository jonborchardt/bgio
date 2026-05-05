// Defense redesign 3.1 — single track-card render.
//
// One small (~80×120 px) card showing the basics of a `TrackCardDef`:
// kind glyph (sword / leaf / gear / crown), name, phase number, and a
// kind-specific one-line readout (threat: dir + offset + strength;
// boon / modifier: brief effect summary; boss: thresholds preview).
// Hovering the card surfaces a `title` tooltip with the full
// description so the strip stays compact while still being readable.
//
// The card has three render modes selected via the `state` prop:
//   - 'past'    — greyed out (history slot at the left of the strip).
//   - 'current' — highlighted accent (just-flipped this round).
//   - 'next'    — telegraphed face-up (defense plans against this).
// Boss cards override these accents with the dedicated `track.boss`
// token regardless of state, so the table reads the boss as different
// from a regular threat at a glance. Visual tokens come exclusively
// from `palette.track.*` per CLAUDE.md's no-raw-hex rule.

import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { TrackCardDef } from '../../data/index.ts';
import { useReducedMotion } from '../layout/useReducedMotion.ts';

export type TrackCardState = 'past' | 'current' | 'next';

export interface TrackCardViewProps {
  card: TrackCardDef;
  state: TrackCardState;
}

// SVG glyph paths per kind. Stroke-only at 1.4 width so the silhouette
// reads at small sizes; `currentColor` lets the parent drive the hue.
const GLYPHS: Record<TrackCardDef['kind'], { d: string; extra?: string }> = {
  // Sword pointing up-right — the canonical "threat" silhouette.
  threat: {
    d: 'M22 4 L28 4 L28 10 L14 24 L10 24 L10 20 Z',
    extra: 'M8 22 L4 26 M14 24 L18 28',
  },
  // Leaf — friendly boon.
  boon: {
    d: 'M6 26 Q6 10 24 8 Q22 24 6 26 Z',
    extra: 'M8 24 L22 10',
  },
  // Gear — modifier card.
  modifier: {
    d: 'M16 6 L18 6 L19 9 L22 10 L24 8 L25.5 9.5 L23.5 12 L24 15 L27 16 L27 18 L24 19 L23.5 22 L25.5 24.5 L24 26 L22 24 L19 25 L18 28 L16 28 L15 25 L12 24 L10 26 L8.5 24.5 L10.5 22 L10 19 L7 18 L7 16 L10 15 L10.5 12 L8.5 9.5 L10 8 L12 10 L15 9 Z',
    extra: 'M16 13 L19 16 L16 19 L13 16 Z',
  },
  // Crown — boss.
  boss: {
    d: 'M4 22 L6 10 L12 16 L16 8 L20 16 L26 10 L28 22 Z',
    extra: 'M4 24 L28 24',
  },
};

const KIND_LABEL: Record<TrackCardDef['kind'], string> = {
  threat: 'Threat',
  boon: 'Boon',
  modifier: 'Modifier',
  boss: 'Boss',
};

interface KindIconProps {
  kind: TrackCardDef['kind'];
  size?: number;
}

// Defense redesign 3.9 — plain-English explanation per kind. Surfaced
// in the tooltip the icon wears so non-developers can read what the
// silhouette means.
const KIND_TOOLTIP: Record<TrackCardDef['kind'], string> = {
  threat: 'Threat — walks toward center along its row/column and damages buildings + the village.',
  boon: 'Boon — friendly card. Resolves immediately on flip with a one-line effect.',
  modifier: 'Modifier — bends rules for one round (range / strength / cost shifts, etc.).',
  boss: 'Boss — final card. Each unmet threshold (Sci / Eco / Mil) costs the village an extra attack.',
};

function KindIcon({ kind, size = 13 }: KindIconProps) {
  const { d, extra } = GLYPHS[kind];
  return (
    <Tooltip title={KIND_TOOLTIP[kind]} placement="top">
      <Box
        component="span"
        role="img"
        aria-label={`${KIND_LABEL[kind]} icon`}
        sx={{
          display: 'inline-flex',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 32 32" width={size} height={size}>
          <path
            d={d}
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {extra ? (
            <path
              d={extra}
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </svg>
      </Box>
    </Tooltip>
  );
}

// Concise per-kind summary line. Keeps the card to ≤ 2 short rows so
// it stays legible at ~80 px wide. Full description hangs off the
// `title` tooltip rather than crowding the card.
const summaryFor = (card: TrackCardDef): string => {
  switch (card.kind) {
    case 'threat': {
      const sign = card.offset > 0 ? `+${card.offset}` : `${card.offset}`;
      return `${card.direction}${sign} • S${card.strength}`;
    }
    case 'boon':
      return 'Boon';
    case 'modifier':
      return card.durationRounds === 1
        ? 'Modifier'
        : `Mod • ${card.durationRounds}r`;
    case 'boss':
      return `Sci ${card.thresholds.science} · Eco ${card.thresholds.economy}`;
  }
};

export function TrackCardView({ card, state }: TrackCardViewProps) {
  const isBoss = card.kind === 'boss';
  const reducedMotion = useReducedMotion();
  // Slightly muted opacity for past cards keeps them visually de-
  // emphasised even with a distinct border accent.
  const opacity = state === 'past' ? 0.55 : 1;
  // Defense redesign 3.9 — make every card focusable so the strip's
  // arrow-key navigation can cycle past → current → next without a
  // mouse. Tabbing into the strip lands on the first focusable card,
  // and arrow keys (handled in TrackStrip) move focus across siblings.
  const ariaCurrent: 'true' | 'false' | undefined =
    state === 'current' ? 'true' : state === 'next' ? 'false' : undefined;

  return (
    <Paper
      elevation={0}
      role="article"
      aria-label={`${KIND_LABEL[card.kind]} — ${card.name}. ${card.description}`}
      aria-current={ariaCurrent}
      tabIndex={0}
      data-track-card="true"
      data-track-card-state={state}
      data-track-card-kind={card.kind}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      title={`${card.name} — ${card.description}`}
      sx={{
        // 30% smaller than the previous 80×120 footprint so the strip
        // fits a deck of ~30 cards onto two rows without horizontal
        // scrolling.
        position: 'relative',
        width: 56,
        height: 84,
        flexShrink: 0,
        px: 0.5,
        py: 0.5,
        borderRadius: 1,
        border: '2px solid',
        borderColor: (t) =>
          isBoss
            ? t.palette.track.boss
            : state === 'current'
              ? t.palette.track.current
              : state === 'next'
                ? t.palette.track.next
                : t.palette.track.past,
        bgcolor: (t) => t.palette.card.surface,
        color: (t) => t.palette.card.text,
        opacity,
        // Defense-redesign 3.9: animation budget = ≤ 250ms, suppressed
        // entirely under prefers-reduced-motion so the card does not
        // visibly fade or shift its border color.
        transition: reducedMotion
          ? 'none'
          : 'opacity 250ms ease, border-color 250ms ease',
        boxShadow: (t) =>
          state === 'current' ? t.palette.shadow.floating : t.palette.shadow.card,
        overflow: 'hidden',
        // Visible focus ring for keyboard users.
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: (t) => t.palette.status.active,
          outlineOffset: 2,
        },
      }}
    >
      <Stack spacing={0.5} sx={{ height: '100%' }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              color: (t) =>
                isBoss
                  ? t.palette.track.boss
                  : state === 'current'
                    ? t.palette.track.current
                    : state === 'next'
                      ? t.palette.track.next
                      : t.palette.track.past,
              display: 'inline-flex',
            }}
          >
            <KindIcon kind={card.kind} />
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.55rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: (t) => t.palette.status.muted,
              lineHeight: 1,
            }}
          >
            P{card.phase}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            lineHeight: 1.1,
            fontSize: '0.6rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.5rem',
            lineHeight: 1.05,
            color: (t) => t.palette.status.muted,
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summaryFor(card)}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default TrackCardView;
