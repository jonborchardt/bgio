// BuildingCard (09.2) — presentational view of a BuildingDef.
//
// Renders the building's name, gold cost, and benefit string. When `count > 1`
// adds a small "×N" badge — used by callers that count-collapse identical
// buildings (e.g. the Domestic grid summary).

import { Box, Stack, Typography } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';
import { CardFrame } from './CardFrame.tsx';

export interface BuildingCardProps {
  def: BuildingDef;
  count?: number;
}

export function BuildingCard({ def, count }: BuildingCardProps) {
  return (
    <CardFrame>
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
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          {def.benefit}
        </Typography>
      </Stack>
    </CardFrame>
  );
}

export default BuildingCard;
