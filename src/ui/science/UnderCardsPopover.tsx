// UnderCardsPopover (05.5) — minimal stub for "peek at the 4 tech cards
// underneath a science card". The full popover wiring (anchored to the
// originating card, click-outside dismissal, focus trap, etc.) is deferred;
// V1 is just an inline list of tech-card names with a Close affordance. The
// SciencePanel doesn't render this today — it's exported here as a hook for
// 09.x to wire later without breaking the file's contract.

import { Box, Button, Stack, Typography } from '@mui/material';
import type { TechnologyDef } from '../../data/schema.ts';

export interface UnderCardsPopoverProps {
  underCards: TechnologyDef[];
  onClose: () => void;
}

export function UnderCardsPopover({
  underCards,
  onClose,
}: UnderCardsPopoverProps) {
  return (
    <Box
      aria-label="Under-cards peek"
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        bgcolor: (t) => t.palette.card.surface,
      }}
    >
      <Stack spacing={0.5}>
        <Typography
          variant="body2"
          sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
        >
          Under cards
        </Typography>
        {underCards.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            (none)
          </Typography>
        ) : (
          underCards.map((tech, i) => (
            <Typography key={`${tech.name}-${i}`} variant="caption">
              {tech.name}
            </Typography>
          ))
        )}
        <Button size="small" variant="outlined" onClick={onClose}>
          Close
        </Button>
      </Stack>
    </Box>
  );
}

export default UnderCardsPopover;
