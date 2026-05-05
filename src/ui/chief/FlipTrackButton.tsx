// Defense redesign 3.8 — FlipTrackButton.
//
// Renders the chief's "Flip Track" action button. Clicking dispatches
// `chiefFlipTrack`; the strip animation + path overlay are driven
// elsewhere (3.1 + 3.3 watch `G.track.lastResolve`), so this
// component's only job is to dispatch and reflect the latch.
//
// State the button reads off the panel:
//   - `canAct`        — chief is in `chiefPhase` (gating mirrors the
//                       move's INVALID_MOVE check; the move is the
//                       source of truth, the button just disables to
//                       avoid a no-op click).
//   - `flipped`       — `G.track.flippedThisRound` per-round latch.
//   - `upcomingCount` — `G.track.upcoming.length`. When 0 (boss already
//                       resolved or track exhausted) the button is
//                       disabled with an explanatory tooltip.
//
// Post-3.9 preference sweep: the button moved into the chief's
// actions row alongside Graveyard / Undo / End-my-turn, so it reads
// as part of the round's action set rather than a buried body
// section. Visual treatment matches the other action buttons (chief
// accent, default `medium` size); disabled reason + status surfaces
// via the wrapping Tooltip — no separate caption.

import { useEffect } from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import { flipTrackDisabledReason } from './flipTrackLogic.ts';

export interface FlipTrackButtonProps {
  canAct: boolean;
  flipped: boolean;
  upcomingCount: number;
  onFlip: () => void;
}

export function FlipTrackButton({
  canAct,
  flipped,
  upcomingCount,
  onFlip,
}: FlipTrackButtonProps) {
  const reason = flipTrackDisabledReason({
    canAct,
    flipped,
    upcomingCount,
  });
  const disabled = reason !== null;

  // Defense redesign 3.9 — keyboard shortcut. Pressing **F** anywhere
  // outside an editable field fires the flip move when the button is
  // currently enabled. We mount a `keydown` listener on the document so
  // the shortcut works regardless of which panel has focus, and we
  // gate on the same disabled / enabled signal the click path uses so
  // the keyboard never bypasses the move's preconditions.
  useEffect(() => {
    if (disabled) return;
    const handler = (evt: globalThis.KeyboardEvent): void => {
      // Ignore when modifier keys are held — those are usually browser
      // / OS shortcuts (Ctrl-F find, etc.) and we don't want to fight
      // them.
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) return;
      if (evt.key !== 'f' && evt.key !== 'F') return;
      // Don't hijack typing in inputs / textareas / contenteditable
      // surfaces.
      const target = evt.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((target as HTMLElement & { isContentEditable?: boolean }).isContentEditable) return;
      }
      evt.preventDefault();
      onFlip();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [disabled, onFlip]);

  // The "ready to flip" state is when the button is enabled — flag it
  // for the test surface so screen readers / e2e can find it.
  const status = flipped
    ? 'flipped'
    : upcomingCount <= 0
      ? 'exhausted'
      : canAct
        ? 'ready'
        : 'waiting';

  const statusLabel = flipped
    ? 'flipped this round'
    : upcomingCount <= 0
      ? 'no cards left'
      : canAct
        ? 'ready to flip'
        : 'waiting for chief phase';

  // Default tooltip surfaces the live status so the chief reads it on
  // hover even when the button is enabled (no separate caption needed).
  const tooltipTitle = reason ?? `Flip the next track card — ${statusLabel}. Keyboard: F.`;

  return (
    <Tooltip title={tooltipTitle}>
      <Box
        component="span"
        sx={{ display: 'inline-flex' }}
        data-flip-track-control="true"
      >
        <Button
          variant="contained"
          disabled={disabled}
          onClick={onFlip}
          aria-label={`Flip the next track card. Status: ${statusLabel}. Keyboard shortcut F.`}
          aria-keyshortcuts="F"
          data-flip-track-button="true"
          data-flip-track-disabled={disabled ? 'true' : 'false'}
          data-flip-track-status={status}
          sx={{
            bgcolor: (t) => t.palette.role.chief.main,
            color: (t) => t.palette.role.chief.contrastText,
            fontWeight: 700,
            letterSpacing: '0.04em',
            '&:hover': {
              bgcolor: (t) => t.palette.role.chief.dark,
            },
          }}
        >
          Flip Track <Box component="span" aria-hidden sx={{ opacity: 0.7, ml: 1, fontSize: '0.7rem' }}>(F)</Box>
        </Button>
      </Box>
    </Tooltip>
  );
}

export default FlipTrackButton;
