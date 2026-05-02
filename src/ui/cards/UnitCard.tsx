// UnitCard — presentational view of a UnitDef. Five canonical sizes
// (see `sizes.ts`). The same component is used in game panels, the
// relationships modal, and React Flow nodes.

import { Box, Stack, Typography } from '@mui/material';
import type { UnitDef } from '../../data/schema.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForUnit } from '../../cards/registry.ts';

export interface UnitCardProps {
  def: UnitDef;
  count?: number;
  size?: CardSize;
  cardId?: string;
}

export function UnitCard({
  def,
  count,
  size = 'normal',
  cardId,
}: UnitCardProps) {
  const id = cardId === undefined ? idForUnit(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
            ⚔ {def.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.resource.gold.main, fontWeight: 600 }}
          >
            {def.cost}g
          </Typography>
        </Stack>
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
          <Stack direction="row" spacing={0.5}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
              A{def.attack}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
              D{def.defense}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
              I{def.initiative}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.resource.gold.main,
              fontWeight: 600,
              fontSize: '0.65rem',
            }}
          >
            {def.cost}g
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  return (
    <CardFrame size={size} cardId={id}>
      <Stack spacing={0.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {def.name}
          </Typography>
          {count !== undefined && count > 1 ? (
            <Box
              aria-label={`Count ${count}`}
              sx={{
                px: 0.75,
                borderRadius: 0.5,
                bgcolor: (t) => t.palette.role.foreign.main,
                color: (t) => t.palette.role.foreign.contrastText,
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              ×{count}
            </Box>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{
              width: '0.625rem',
              height: '0.625rem',
              borderRadius: '50%',
              bgcolor: (t) => t.palette.resource.gold.main,
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.resource.gold.main, fontWeight: 600 }}
          >
            {def.cost}g
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.25}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            ATK {def.attack}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            DEF {def.defense}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            INI {def.initiative}
          </Typography>
        </Stack>
        {(size === 'detailed' || size === 'page') && def.requires ? (
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, lineHeight: 1.3 }}
          >
            <Box component="span" sx={{ fontWeight: 700 }}>
              Requires:
            </Box>{' '}
            {def.requires}
          </Typography>
        ) : null}
        {(size === 'detailed' || size === 'page') && def.note ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              lineHeight: 1.35,
            }}
          >
            {def.note}
          </Typography>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default UnitCard;
