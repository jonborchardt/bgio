// BattleCard — presentational view of a BattleCardDef. Five canonical
// sizes (see `sizes.ts`).

import { Box, Stack, Typography } from '@mui/material';
import type { BattleCardDef } from '../../data/battleCards.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForBattle } from '../../cards/registry.ts';
import { ResourceChip } from '../resources/ResourceChip.tsx';
import { RESOURCES } from '../../game/resources/types.ts';
import type { Resource, ResourceBag } from '../../game/resources/types.ts';

export interface BattleCardProps {
  def: BattleCardDef;
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

const summarizeUnits = (units: ReadonlyArray<{ name: string; count: number }>) =>
  units.map((u) => (u.count > 1 ? `${u.count}× ${u.name}` : u.name)).join(', ');

export function BattleCard({
  def,
  size = 'normal',
  cardId,
}: BattleCardProps) {
  const id = cardId === undefined ? idForBattle(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
          ⚔ Battle #{def.id}
        </Typography>
      </CardFrame>
    );
  }

  if (size === 'small') {
    return (
      <CardFrame size="small" cardId={id}>
        <Stack spacing={0.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Battle #{def.number}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.6rem', color: (t) => t.palette.status.muted }}
            noWrap
          >
            {summarizeUnits(def.units)}
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
            Battle
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
            Enemy force
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3 }}>
            {summarizeUnits(def.units)}
          </Typography>
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
            Tribute on loss
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.25 }}>
            {bagResources(def.failure.tribute).map((r) => (
              <ResourceChip
                key={r}
                resource={r}
                count={def.failure.tribute[r] ?? 0}
                size="sm"
                label={`${r} ${def.failure.tribute[r]}`}
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

export default BattleCard;
