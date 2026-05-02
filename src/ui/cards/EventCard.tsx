// EventCard — five canonical sizes (see `sizes.ts`). In face-down mode
// only renders the card back (no name, no color stripe) so playerView
// redaction stays honest. The `?` button is suppressed when face-down.

import { Box, Stack, Typography } from '@mui/material';
import type { EventCardDef } from '../../data/events.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForEvent } from '../../cards/registry.ts';

export interface EventCardProps {
  def: EventCardDef;
  faceDown?: boolean;
  size?: CardSize;
  cardId?: string;
}

export function EventCard({
  def,
  faceDown,
  size = 'normal',
  cardId,
}: EventCardProps) {
  if (faceDown === true) {
    return (
      <CardFrame size={size}>
        <Box
          aria-label="Face-down event card"
          sx={{
            minHeight: size === 'micro' ? '0.75rem' : '4rem',
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

  const id = cardId === undefined ? idForEvent(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" color={def.color} cardId={id}>
        <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
          ★ {def.name}
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    return (
      <CardFrame size="small" color={def.color} cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.eventColor[def.color].main,
              fontWeight: 600,
              textTransform: 'capitalize',
              fontSize: '0.6rem',
            }}
          >
            {def.color}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  return (
    <CardFrame size={size} color={def.color} cardId={id}>
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
        {size === 'detailed' ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, lineHeight: 1.3 }}
          >
            {def.effects.length} effect{def.effects.length === 1 ? '' : 's'}
          </Typography>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default EventCard;
