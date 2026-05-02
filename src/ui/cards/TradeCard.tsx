// TradeCard — presentational view of a TradeCardDef. Five canonical
// sizes (see `sizes.ts`). The trade slot in the center mat doesn't
// currently use a real card — this component is what the relationships
// modal uses, and what the in-game card UI will use once the trade flow
// is wired through canonical cards.

import { Box, Stack, Typography } from '@mui/material';
import type { TradeCardDef } from '../../data/tradeCards.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForTrade } from '../../cards/registry.ts';
import { ResourceChip } from '../resources/ResourceChip.tsx';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';

export interface TradeCardProps {
  def: TradeCardDef;
  size?: CardSize;
  cardId?: string;
}

const bagResources = (bag: Partial<ResourceBag>): Resource[] => {
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    if ((bag[r] ?? 0) > 0) out.push(r);
  }
  return out;
};

const compactBag = (bag: Partial<ResourceBag>): string =>
  bagResources(bag)
    .map((r) => `${bag[r]}${r[0]}`)
    .join(' ');

export function TradeCard({
  def,
  size = 'normal',
  cardId,
}: TradeCardProps) {
  const id = cardId === undefined ? idForTrade(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
          🛒 Trade #{def.id}
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    return (
      <CardFrame size="small" cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Trade #{def.number}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
            {compactBag(def.required)} → {compactBag(def.reward)}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  return (
    <CardFrame size={size} cardId={id}>
      <Stack spacing={0.75}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Trade Request
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Tier {def.number}
          </Typography>
        </Stack>
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontSize: '0.65rem',
            }}
          >
            Required
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.25 }}>
            {bagResources(def.required).map((r) => (
              <ResourceChip
                key={r}
                resource={r}
                count={def.required[r] ?? 0}
                size="sm"
                label={`${r} ${def.required[r]}`}
              />
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontSize: '0.65rem',
            }}
          >
            Reward
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.25 }}>
            {bagResources(def.reward).map((r) => (
              <ResourceChip
                key={r}
                resource={r}
                count={def.reward[r] ?? 0}
                size="sm"
                label={`${r} ${def.reward[r]}`}
              />
            ))}
          </Stack>
        </Box>
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

export default TradeCard;
