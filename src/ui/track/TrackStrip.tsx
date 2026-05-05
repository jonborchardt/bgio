// Defense redesign 3.1 — track strip.
//
// Horizontal strip the table reads to know "what just hit." Layout
// (left → right):
//
//   [ phase markers (1..10, boss highlighted) ]
//   [ past₁ past₂ … past_n  |  CURRENT  |  ░ ░ ░ ░ ]
//
//   - Past cards   — `state="past"`, greyed via `track.past` border.
//   - Current card — `state="current"`, accent from `track.current`.
//                    Slides into the past row at round transition
//                    (CSS `transition` on opacity + border-color, ~250
//                    ms; the slide itself is implicit — the card is
//                    re-keyed by `id` so React swaps placements without
//                    layout thrash).
//   - Face-down hint — a row of small ░ tiles representing every card
//                    still in the deck (no face-up telegraph; the
//                    village only sees what has been flipped).
//
// The strip is purely presentational — it reads `G.track` (history,
// upcoming.length, currentPhase) and renders. No moves are dispatched
// here. The face-up "next" telegraph slot was removed in the post-3.9
// preference sweep so the table starts empty until the chief flips
// the first card; the village only sees what has actually resolved.

import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { TrackCardDef } from '../../data/index.ts';
import { TrackCardView } from './TrackCardView.tsx';
import { PhaseMarker } from './PhaseMarker.tsx';
import { BossReadout } from './BossReadout.tsx';

export interface TrackStripProps {
  /** Already-flipped cards, oldest first. */
  history: TrackCardDef[];
  /** The card just flipped this round (history's last entry on the
   *  round boundary; rendered as the highlighted "current" slot). When
   *  the track was never flipped this round, `current` is `undefined`
   *  and the slot collapses. */
  current?: TrackCardDef;
  /** Total face-down cards remaining in the deck. Drives the width of
   *  the face-down hint row. (No face-up telegraph slot — the village
   *  only sees what has been flipped.) */
  upcomingCount: number;
  /** Cached `G.track.currentPhase`. Used to highlight the active
   *  phase marker above the strip. */
  phase: number;
  /** The boss card (always present in the deck, lives in phase 10).
   *  When supplied alongside `villageTotals` the strip renders a
   *  `<BossReadout>` so the village can track its progress against the
   *  printed thresholds throughout the game — not just when the boss
   *  is about to flip. */
  boss?: TrackCardDef;
  /** Post-3.9 preference sweep — when `true`, the boss has not yet
   *  flipped (it still sits in `upcoming`). The readout renders in a
   *  subdued/desaturated treatment so the table reads it as a
   *  "looming" preview, not a flipped card. */
  bossLooming?: boolean;
  /** Live village totals against the boss thresholds (3.5). Optional —
   *  the strip renders a `<BossReadout>` whenever both `boss` and
   *  `villageTotals` are supplied. Computed by the parent (Board.tsx)
   *  from `G` so the readout updates as science completes / units
   *  gain strength / bank changes. */
  villageTotals?: {
    science: number;
    economy: number;
    military: number;
  };
}

const PAST_VISIBLE_LIMIT = 6; // Cap rendered history to keep the strip readable.
const PHASE_COUNT = 10;
const FACE_DOWN_VISIBLE_LIMIT = 8; // Cap ░ tiles; show "+N" when above.

// Small face-down placeholder tile. Same width as the card slot so
// the row aligns visually with the played cards above it.
function FaceDownTile() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 14,
        height: 22,
        flexShrink: 0,
        borderRadius: 0.5,
        border: '1px dashed',
        borderColor: (t) => t.palette.status.muted,
        bgcolor: (t) => t.palette.card.takenSurface,
        opacity: 0.6,
      }}
    />
  );
}

export function TrackStrip({
  history,
  current,
  upcomingCount,
  phase,
  boss,
  bossLooming = false,
  villageTotals,
}: TrackStripProps) {
  // Visible past cards: the most-recently-flipped slice of `history`,
  // capped at PAST_VISIBLE_LIMIT. We render oldest → newest left to
  // right so the just-played card sits adjacent to the current slot.
  const visiblePast = useMemo(() => {
    if (history.length <= PAST_VISIBLE_LIMIT) return history;
    return history.slice(history.length - PAST_VISIBLE_LIMIT);
  }, [history]);
  const truncatedPast = history.length - visiblePast.length;

  // Visible face-down hint count.
  const faceDownVisible = Math.max(
    0,
    Math.min(FACE_DOWN_VISIBLE_LIMIT, upcomingCount),
  );
  const faceDownExtra = Math.max(0, upcomingCount - faceDownVisible);

  const phases = useMemo(
    () => Array.from({ length: PHASE_COUNT }, (_, i) => i + 1),
    [],
  );

  // Defense redesign 3.9 — keyboard navigation. The card row is
  // explicitly focusable (each TrackCardView has `tabIndex={0}`); arrow
  // keys (Left / Right) move focus across siblings, Home / End jump to
  // the first / last focusable card. Up / Down are intentional no-ops
  // because the strip is one-dimensional. We intercept the event at the
  // strip level (rather than per card) so adjacent cards don't have to
  // know about each other — the strip queries DOM siblings at the
  // moment the key fires.
  const cardRowRef = useRef<HTMLDivElement | null>(null);
  const handleCardRowKeyDown = useCallback((evt: KeyboardEvent<HTMLDivElement>) => {
    const row = cardRowRef.current;
    if (row === null) return;
    const target = evt.target as HTMLElement | null;
    if (target === null) return;
    // Only react when focus is on a track-card child.
    if (target.dataset.trackCard !== 'true') return;
    const cards = Array.from(
      row.querySelectorAll<HTMLElement>('[data-track-card="true"]'),
    );
    if (cards.length === 0) return;
    const idx = cards.indexOf(target);
    let nextIdx = idx;
    switch (evt.key) {
      case 'ArrowRight':
        nextIdx = Math.min(cards.length - 1, idx + 1);
        break;
      case 'ArrowLeft':
        nextIdx = Math.max(0, idx - 1);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = cards.length - 1;
        break;
      default:
        return;
    }
    if (nextIdx === idx) return;
    evt.preventDefault();
    const nextCard = cards[nextIdx];
    if (nextCard === undefined) return;
    nextCard.focus();
  }, []);

  return (
    <Box
      data-testid="track-strip"
      role="region"
      aria-label="Global event track. Use arrow keys to move between past and current cards."
      sx={{
        width: '100%',
        py: 1,
        px: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        bgcolor: (t) => t.palette.appSurface.base,
      }}
    >
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        {/* Phase marker row. Width-distributed so the markers roughly
            line up with the card slots beneath them when the track is
            mid-game. We keep this simple — equal spacing across the
            ten phases — rather than trying to perfectly align with the
            actual card positions, which would require measuring DOM. */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ overflowX: 'auto', alignItems: 'center' }}
          role="list"
          aria-label="Phase markers"
        >
          {phases.map((p) => (
            <Box key={p} component="span" role="listitem">
              <PhaseMarker
                phase={p}
                active={p === phase}
                boss={p === PHASE_COUNT}
              />
            </Box>
          ))}
        </Stack>

        {/* Card row. Horizontal scroll on overflow so the strip never
            forces the page wider than the play area. */}
        <Stack
          ref={cardRowRef}
          direction="row"
          spacing={1}
          data-testid="track-strip-cards"
          onKeyDown={handleCardRowKeyDown}
          sx={{ overflowX: 'auto', minWidth: 0, alignItems: 'center' }}
        >
          {truncatedPast > 0 ? (
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontStyle: 'italic',
                flexShrink: 0,
              }}
            >
              +{truncatedPast} earlier
            </Typography>
          ) : null}

          {visiblePast.map((card, i) => (
            <TrackCardView
              key={`past:${card.id}:${i}`}
              card={card}
              state="past"
            />
          ))}

          {/* Divider between past and current — thin vertical rule.
              Note: MUI's sx interprets a bare `width: 1` as 100%
              (theme shorthand), so we have to spell out a CSS pixel
              value or the divider blows up to a full-width gray bar
              spanning the strip. Hard-pixel value here is intentional. */}
          {(visiblePast.length > 0 || truncatedPast > 0) &&
          current !== undefined ? (
            <Box
              aria-hidden
              sx={{
                width: '1px',
                height: 80,
                bgcolor: (t) => t.palette.status.muted,
                opacity: 0.4,
                flexShrink: 0,
              }}
            />
          ) : null}

          {current !== undefined ? (
            <TrackCardView
              key={`current:${current.id}`}
              card={current}
              state="current"
            />
          ) : null}

          {/* Defense redesign 3.5 — boss thresholds readout. Rendered
              throughout the game when the parent supplies the boss
              card + live `villageTotals` (the boss is always in the
              deck, so the readout is always meaningful). Earlier
              passes only showed it when the boss was the face-up
              telegraph, but that slot was removed — the readout now
              tracks village progress from round 1. The board wires
              the totals from `G` (science completed count, bank gold,
              sum of unit strength) so they update live as science
              completes / units gain strength / bank changes. */}
          {boss !== undefined &&
          boss.kind === 'boss' &&
          villageTotals !== undefined ? (
            <BossReadout
              boss={boss}
              current={villageTotals}
              looming={bossLooming}
            />
          ) : null}

          {/* Face-down hint row. */}
          {faceDownVisible > 0 || faceDownExtra > 0 ? (
            <Stack
              direction="row"
              spacing={0.25}
              data-testid="track-strip-facedown"
              aria-label={`Face-down cards remaining: ${upcomingCount}`}
              sx={{ pl: 0.5, flexShrink: 0, alignItems: 'center' }}
            >
              {Array.from({ length: faceDownVisible }, (_, i) => (
                <FaceDownTile key={i} />
              ))}
              {faceDownExtra > 0 ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.status.muted,
                    pl: 0.25,
                    fontStyle: 'italic',
                  }}
                >
                  +{faceDownExtra}
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          {/* Empty-deck label when there is nothing left at all. */}
          {visiblePast.length === 0 &&
          truncatedPast === 0 &&
          current === undefined &&
          upcomingCount === 0 ? (
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.status.muted,
                fontStyle: 'italic',
              }}
            >
              Track empty
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export default TrackStrip;
