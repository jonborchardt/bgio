// ChiefActionButton — unified chief-phase action.
//
// One button slot that morphs based on the round's state. During the
// chief's turn it shows "Flip Track" until the round's card has been
// flipped; once flipped (or when there is no track at all) it morphs
// into "End my turn." Replaces the previous pair of separate buttons —
// the flow always goes flip-then-end, so giving the table two buttons
// at once was redundant.
//
// State machine:
//   - !canAct                         → button hidden (panel doesn't
//                                        render this outside chief phase).
//   - hasTrack && !flipped && deck>0  → "Flip Track" mode (dispatch
//                                        chiefFlipTrack).
//   - else                             → "End my turn" mode (dispatch
//                                        chiefEndPhase).
//
// Keyboard shortcut: while in Flip mode the chief can press `F` (the
// existing 3.9 shortcut). End-turn mode has no shortcut by design — the
// chief should look at what just happened on the board before clicking
// through.

import { useEffect } from 'react';
import { Box, Button, Tooltip } from '@mui/material';

export type ChiefActionMode = 'flip' | 'end';

export interface ChiefActionButtonProps {
  /** True only during `chiefPhase`. The button assumes the parent has
   *  already gated rendering on this — the prop is kept so unit tests
   *  can drive the disabled branch without un-rendering. */
  canAct: boolean;
  /** `G.track.flippedThisRound`. */
  flipped: boolean;
  /** Whether the engine has a `track` slot at all. */
  hasTrack: boolean;
  /** Number of cards remaining face-down in the upcoming pile. */
  upcomingCount: number;
  /** Dispatches `chiefFlipTrack`. */
  onFlip: () => void;
  /** Dispatches `chiefEndPhase`. */
  onEnd: () => void;
}

const computeMode = (args: {
  hasTrack: boolean;
  flipped: boolean;
  upcomingCount: number;
}): ChiefActionMode => {
  if (!args.hasTrack) return 'end';
  if (args.flipped) return 'end';
  if (args.upcomingCount <= 0) return 'end';
  return 'flip';
};

export function ChiefActionButton({
  canAct,
  flipped,
  hasTrack,
  upcomingCount,
  onFlip,
  onEnd,
}: ChiefActionButtonProps) {
  const mode = computeMode({ hasTrack, flipped, upcomingCount });
  const disabled = !canAct;

  // `F` shortcut for the flip path. Only bound while the button is in
  // flip mode + enabled, so a chief who has already flipped won't
  // accidentally trigger end-turn from a stray keypress.
  useEffect(() => {
    if (mode !== 'flip' || disabled) return;
    const handler = (evt: globalThis.KeyboardEvent): void => {
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) return;
      if (evt.key !== 'f' && evt.key !== 'F') return;
      const target = evt.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (
          (target as HTMLElement & { isContentEditable?: boolean })
            .isContentEditable
        )
          return;
      }
      evt.preventDefault();
      onFlip();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [mode, disabled, onFlip]);

  const label = mode === 'flip' ? 'Flip Track' : 'End my turn';
  const ariaLabel =
    mode === 'flip'
      ? 'Flip the next track card. Keyboard shortcut F.'
      : 'End my turn.';
  const tooltipTitle = disabled
    ? 'Available only during your phase.'
    : mode === 'flip'
      ? 'Flip the next track card. Keyboard: F.'
      : 'End your turn. The next phase begins.';

  const onClick = mode === 'flip' ? onFlip : onEnd;

  return (
    <Tooltip title={tooltipTitle}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Button
          variant="contained"
          disabled={disabled}
          onClick={onClick}
          data-chief-action-button="true"
          data-chief-action-mode={mode}
          data-chief-action-disabled={disabled ? 'true' : 'false'}
          aria-label={ariaLabel}
          aria-keyshortcuts={mode === 'flip' ? 'F' : undefined}
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
          {label}
          {mode === 'flip' ? (
            <Box
              component="span"
              aria-hidden
              sx={{ opacity: 0.7, ml: 1, fontSize: '0.7rem' }}
            >
              (F)
            </Box>
          ) : null}
        </Button>
      </Box>
    </Tooltip>
  );
}

export default ChiefActionButton;
