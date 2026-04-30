// EventCard (09.2) — presentational view of an EventCardDef.
//
// In face-down mode (default for the opponent's hand etc.), only renders the
// card back — no name, no color stripe — so playerView redaction stays honest.
// In face-up mode, renders the card name with a colored CardFrame stripe.

import { Box, Stack, Typography } from '@mui/material';
import type { EventCardDef } from '../../data/events.ts';
import { CardFrame } from './CardFrame.tsx';

export interface EventCardProps {
  def: EventCardDef;
  faceDown?: boolean;
}

export function EventCard({ def, faceDown }: EventCardProps) {
  if (faceDown === true) {
    return (
      <CardFrame>
        <Box
          aria-label="Face-down event card"
          sx={{
            minHeight: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: (t) => t.palette.status.muted,
            fontWeight: 700,
            letterSpacing: '0.1em',
          }}
        >
          ?
        </Box>
      </CardFrame>
    );
  }
  return (
    <CardFrame color={def.color}>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {def.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.eventColor[def.color].main,
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {def.color}
        </Typography>
      </Stack>
    </CardFrame>
  );
}

export default EventCard;
