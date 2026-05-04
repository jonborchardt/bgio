// Defense redesign 3.8 — FlipTrackButton.
//
// Renders the chief's "Flip Track" button + a per-round status caption.
// Clicking dispatches `chiefFlipTrack`; the strip animation + path
// overlay are driven elsewhere (3.1 + 3.3 watch `G.track.lastResolve`),
// so this component's only job is to dispatch and reflect the latch.
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
// Visual treatment: chief-accent contained button, sized large to read
// as the round's table-presence beat (D22). Disabled reasons surface
// via a wrapping Tooltip + a status caption below; we never communicate
// disabled state via color alone (CLAUDE.md a11y rule).

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
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

  return (
    <Stack
      spacing={0.5}
      data-flip-track-control="true"
      sx={{ alignItems: 'flex-start' }}
    >
      <Tooltip title={reason ?? ''} disableHoverListener={!disabled}>
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <Button
            variant="contained"
            size="large"
            disabled={disabled}
            onClick={onFlip}
            aria-label="Flip the next track card"
            data-flip-track-button="true"
            data-flip-track-disabled={disabled ? 'true' : 'false'}
            data-flip-track-status={status}
            sx={{
              bgcolor: (t) => t.palette.role.chief.main,
              color: (t) => t.palette.role.chief.contrastText,
              fontWeight: 700,
              letterSpacing: '0.04em',
              px: 3,
              py: 1.25,
              '&:hover': {
                bgcolor: (t) => t.palette.role.chief.dark,
              },
            }}
          >
            Flip Track
          </Button>
        </Box>
      </Tooltip>
      <Typography
        variant="caption"
        data-flip-track-status-caption={status}
        sx={{
          color: (t) =>
            flipped
              ? t.palette.status.muted
              : disabled
                ? t.palette.status.muted
                : t.palette.role.chief.light,
        }}
      >
        Flip Track: {statusLabel}
      </Typography>
    </Stack>
  );
}

export default FlipTrackButton;
