// WanderCard — presentational view of a WanderCardDef. Five canonical
// sizes (see `sizes.ts`).

import { Stack, Typography } from '@mui/material';
import type { WanderCardDef } from '../../data/wanderCards.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForWander } from '../../cards/registry.ts';

export interface WanderCardProps {
  def: WanderCardDef;
  size?: CardSize;
  cardId?: string;
}

export function WanderCard({
  def,
  size = 'normal',
  cardId,
}: WanderCardProps) {
  const id = cardId === undefined ? idForWander(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
          🌫 {def.name}
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    return (
      <CardFrame size="small" cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontSize: '0.6rem' }}
          >
            {def.effects.length} effect{def.effects.length === 1 ? '' : 's'}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  return (
    <CardFrame size={size} cardId={id}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {def.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          {def.effects.length} effect{def.effects.length === 1 ? '' : 's'}
        </Typography>
        {def.flavor && (size === 'detailed' || size === 'page') ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              lineHeight: 1.35,
            }}
          >
            {def.flavor}
          </Typography>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default WanderCard;
