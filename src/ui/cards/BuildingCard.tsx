// BuildingCard — presentational view of a BuildingDef.
//
// Renders five canonical sizes via the `size` prop (see `sizes.ts`).
// The same component is used everywhere a building card appears: game
// panels, hand strips, list views in the relationships modal, and React
// Flow nodes in the graph. There is no second "viz-only" version.

import { Box, Stack, Typography } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';
import { CardFrame } from './CardFrame.tsx';
import type { CardSize } from './sizes.ts';
import { idForBuilding } from '../../cards/registry.ts';

export interface BuildingCardProps {
  def: BuildingDef;
  count?: number;
  size?: CardSize;
  /** Override the auto-derived card id (`building:<name>`). Pass an
   *  empty string to suppress the `?` button entirely. */
  cardId?: string;
}

export function BuildingCard({
  def,
  count,
  size = 'normal',
  cardId,
}: BuildingCardProps) {
  const id = cardId === undefined ? idForBuilding(def) : cardId || undefined;

  if (size === 'micro') {
    return (
      <CardFrame size="micro" cardId={id}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
            🏛 {def.name}
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
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontSize: '0.6rem',
              lineHeight: 1.2,
            }}
          >
            {def.benefit}
          </Typography>
        </Stack>
      </CardFrame>
    );
  }

  // normal / detailed / page share the same body; detailed/page extend
  // with note + cost-bag breakdown.
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
                bgcolor: (t) => t.palette.role.domestic.main,
                color: (t) => t.palette.role.domestic.contrastText,
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
            {def.costBag
              ? ` (${Object.entries(def.costBag)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(', ')})`
              : ''}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          {def.benefit}
        </Typography>
        {(size === 'detailed' || size === 'page') && def.note ? (
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              lineHeight: 1.35,
              pt: 0.5,
            }}
          >
            {def.note}
          </Typography>
        ) : null}
      </Stack>
    </CardFrame>
  );
}

export default BuildingCard;
