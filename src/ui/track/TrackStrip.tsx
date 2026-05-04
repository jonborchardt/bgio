// Defense redesign 3.1 — track strip.
//
// Horizontal strip the table reads to know "what just hit" / "what's
// coming." Layout (left → right):
//
//   [ phase markers (1..10, boss highlighted) ]
//   [ past₁ past₂ … past_n  |  CURRENT  |  NEXT  |  ░ ░ ░ ░ ]
//
//   - Past cards   — `state="past"`, greyed via `track.past` border.
//   - Current card — `state="current"`, accent from `track.current`.
//                    Slides into the past row at round transition
//                    (CSS `transition` on opacity + border-color, ~250
//                    ms; the slide itself is implicit — the card is
//                    re-keyed by `id` so React swaps placements without
//                    layout thrash).
//   - Next card    — `state="next"`, telegraphed via `track.next`.
//   - Face-down hint — a row of small ░ tiles representing the count
//                    of cards still in the deck after `next`.
//
// The strip is purely presentational — it reads `G.track` (history,
// upcoming[0], upcoming[1], upcoming.length, currentPhase) and
// renders. No moves are dispatched here; click affordances are
// reserved for sub-phase 3.6 (red-tech track manipulation).

import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { TrackCardDef } from '../../data/index.ts';
import { TrackCardView } from './TrackCardView.tsx';
import { PhaseMarker } from './PhaseMarker.tsx';

export interface TrackStripProps {
  /** Already-flipped cards, oldest first. */
  history: TrackCardDef[];
  /** The card just flipped this round (history's last entry on the
   *  round boundary; rendered as the highlighted "current" slot). When
   *  the track was never flipped this round, `current` is `undefined`
   *  and the slot collapses. */
  current?: TrackCardDef;
  /** The face-up telegraph card. Defense plans against this. */
  next?: TrackCardDef;
  /** Count of cards remaining in the deck *after* `next`. Drives the
   *  width of the face-down hint row. */
  upcomingCount: number;
  /** Cached `G.track.currentPhase`. Used to highlight the active
   *  phase marker above the strip. */
  phase: number;
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
  next,
  upcomingCount,
  phase,
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

  return (
    <Box
      data-testid="track-strip"
      aria-label="Global event track"
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
          direction="row"
          spacing={1}
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

          {/* Divider between past and current — small vertical rule. */}
          {(visiblePast.length > 0 || truncatedPast > 0) &&
          (current !== undefined || next !== undefined) ? (
            <Box
              aria-hidden
              sx={{
                width: 1,
                height: 100,
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

          {next !== undefined ? (
            <TrackCardView
              key={`next:${next.id}`}
              card={next}
              state="next"
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
          next === undefined &&
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
