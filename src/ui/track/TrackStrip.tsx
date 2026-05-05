// Track strip — unified single-row timeline.
//
// Every card on the deck (past flips + the just-flipped current + the
// face-down upcoming + the boss) renders as one ordered list. Phase
// boundaries are background bands keyed by phase color from
// `palette.track.phaseMarkers`; a small phase chip sits above the
// first slot of each new phase. The boss is always the last slot.
//
// The strip is purely presentational. It reads the parent's already-
// split history / current / upcoming arrays and assembles a single
// `slots[]` list — no engine state mutated, no moves dispatched.

import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { TrackCardDef } from '../../data/index.ts';
import { TrackCardView } from './TrackCardView.tsx';

export interface TrackStripProps {
  /** Already-flipped cards, oldest first (excluding the just-flipped
   *  card when it sits in the `current` slot). */
  history: TrackCardDef[];
  /** The card just flipped this round; `undefined` between flips. */
  current?: TrackCardDef;
  /** Remaining face-down cards in deck order. The strip reads each
   *  card's `phase` to draw the phase band but does NOT reveal the
   *  card identity to the player — face-down cards render as ░ tiles
   *  even though the strip has the full def. */
  upcoming: TrackCardDef[];
  /** Cached `G.track.currentPhase`. Used to highlight the active
   *  phase chip inside the unified row. */
  phase: number;
}

type SlotState = 'past' | 'current' | 'upcoming';

interface Slot {
  /** Stable key derived from the slot's deck index. */
  key: string;
  /** Phase the slot belongs to (1..10). */
  phase: number;
  /** Whether the slot is a boss card (always the last one). */
  isBoss: boolean;
  /** Visual / interaction state. */
  state: SlotState;
  /** The card def — passed only for past / current slots; included
   *  for upcoming slots too so the strip can read `phase`, but the
   *  rendered tile stays face-down. */
  card: TrackCardDef;
}

/** Face-down placeholder. Same width as the small face-up card so
 *  the unified row reads as a single series. */
function FaceDownTile({ phase, isBoss }: { phase: number; isBoss: boolean }) {
  return (
    <Tooltip
      title={isBoss ? 'Boss — last card on the deck' : `Phase ${phase} — face-down`}
      placement="top"
    >
      <Box
        aria-hidden
        data-track-card="false"
        data-track-card-state="upcoming"
        data-track-phase={phase}
        data-track-card-boss={isBoss ? 'true' : 'false'}
        sx={{
          // Face-down slots — including the boss — all render as a
          // small ░ marker. The boss only bumps up to full size once
          // it actually flips (which routes through TrackCardView,
          // not through this face-down placeholder). The boss tile
          // gets a slightly bolder border + accent so the table can
          // still spot the tail without a size jump.
          width: 14,
          height: 22,
          flexShrink: 0,
          borderRadius: 0.5,
          border: isBoss ? '1.5px solid' : '1px dashed',
          borderColor: (t) =>
            isBoss ? t.palette.track.boss : t.palette.status.muted,
          bgcolor: (t) => t.palette.card.takenSurface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: (t) =>
            isBoss ? t.palette.track.boss : t.palette.status.muted,
          opacity: isBoss ? 0.95 : 0.5,
        }}
      />
    </Tooltip>
  );
}

export function TrackStrip({
  history,
  current,
  upcoming,
  phase,
}: TrackStripProps) {
  // Unified slot list, deck-order. Slot.key embeds the deck index so
  // React keeps stable identity even when a face-down slot promotes
  // into a flipped one.
  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    let idx = 0;
    for (const card of history) {
      out.push({
        key: `slot:${idx}`,
        phase: card.phase,
        isBoss: card.kind === 'boss',
        state: 'past',
        card,
      });
      idx += 1;
    }
    if (current !== undefined) {
      out.push({
        key: `slot:${idx}`,
        phase: current.phase,
        isBoss: current.kind === 'boss',
        state: 'current',
        card: current,
      });
      idx += 1;
    }
    for (const card of upcoming) {
      out.push({
        key: `slot:${idx}`,
        phase: card.phase,
        isBoss: card.kind === 'boss',
        state: 'upcoming',
        card,
      });
      idx += 1;
    }
    return out;
  }, [history, current, upcoming]);

  // Keyboard navigation across face-up cards (arrow keys).
  const cardRowRef = useRef<HTMLDivElement | null>(null);
  const handleCardRowKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLDivElement>) => {
      const row = cardRowRef.current;
      if (row === null) return;
      const target = evt.target as HTMLElement | null;
      if (target === null) return;
      if (target.dataset.trackCard !== 'true') return;
      const cards = Array.from(
        row.querySelectorAll<HTMLElement>('[data-track-card="true"]'),
      );
      if (cards.length === 0) return;
      const cur = cards.indexOf(target);
      let next = cur;
      switch (evt.key) {
        case 'ArrowRight':
          next = Math.min(cards.length - 1, cur + 1);
          break;
        case 'ArrowLeft':
          next = Math.max(0, cur - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = cards.length - 1;
          break;
        default:
          return;
      }
      if (next === cur) return;
      evt.preventDefault();
      const node = cards[next];
      if (node === undefined) return;
      node.focus();
    },
    [],
  );

  return (
    <Box
      data-testid="track-strip"
      role="region"
      aria-label="Global event track. Use arrow keys to move between flipped cards."
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
      <Box
        ref={cardRowRef}
        data-testid="track-strip-cards"
        onKeyDown={handleCardRowKeyDown}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          rowGap: 0.75,
          columnGap: 0.5,
          alignItems: 'flex-end',
          minWidth: 0,
        }}
      >
        {slots.length === 0 ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
            }}
          >
            Track empty
          </Typography>
        ) : (
          slots.map((slot, i) => {
            const prev = i > 0 ? slots[i - 1] : undefined;
            // The boss always shows its own chip even when other phase-10
            // cards precede it — the table needs the boss tail clearly
            // marked at a glance.
            const isPhaseStart =
              prev === undefined || prev.phase !== slot.phase || slot.isBoss;
            const phaseColor = (theme: import('@mui/material/styles').Theme) =>
              theme.palette.track.phaseMarkers[slot.phase - 1] ??
              theme.palette.status.muted;
            const isPhaseActive = slot.phase === phase;
            return (
              <Box
                key={slot.key}
                data-slot-phase={slot.phase}
                data-slot-state={slot.state}
                data-slot-boss={slot.isBoss ? 'true' : 'false'}
                data-slot-phase-start={isPhaseStart ? 'true' : 'false'}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  // First slot of a phase group gets a left-edge accent
                  // band so the table reads phase boundaries without a
                  // separate marker row.
                  borderLeft: isPhaseStart ? '2px solid' : 'none',
                  borderColor: phaseColor,
                  pl: isPhaseStart ? 0.5 : 0,
                  ml: isPhaseStart && i > 0 ? 0.5 : 0,
                }}
              >
                {/* Phase chip — only on the first slot of each phase
                    group, AND only when the slot is still face-down
                    (or the boss). Flipped face-up cards already carry
                    their own "P{n}" header inside `<TrackCardView>`,
                    so an extra chip above them would be redundant. */}
                {isPhaseStart && (slot.state === 'upcoming' || slot.isBoss) ? (
                  <Box
                    component="span"
                    aria-label={`Phase ${slot.phase}${isPhaseActive ? ', active' : ''}${slot.isBoss ? ', boss' : ''}`}
                    data-phase-chip={slot.phase}
                    data-phase-active={isPhaseActive ? 'true' : 'false'}
                    sx={(t) => ({
                      mb: 0.25,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      bgcolor: slot.isBoss
                        ? t.palette.track.boss
                        : phaseColor(t),
                      color: t.palette.card.surface,
                      opacity: isPhaseActive || slot.isBoss ? 1 : 0.55,
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {slot.isBoss ? 'BOSS' : `P${slot.phase}`}
                  </Box>
                ) : (
                  <Box sx={{ height: 14, mb: 0.25 }} aria-hidden />
                )}

                {/* Slot body. */}
                {slot.state === 'upcoming' ? (
                  <FaceDownTile phase={slot.phase} isBoss={slot.isBoss} />
                ) : (
                  <TrackCardView
                    card={slot.card}
                    state={slot.state === 'current' ? 'current' : 'past'}
                  />
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}

export default TrackStrip;
