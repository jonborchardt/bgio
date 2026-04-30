// UnitCard (09.2) — presentational view of a UnitDef.
//
// Renders the unit's name, gold cost, attack / defense / initiative stats.
// When `count > 1` adds a "×N" badge — used by the Foreign army row to
// count-collapse identical units.

import { Box, Stack, Typography } from '@mui/material';
import type { UnitDef } from '../../data/schema.ts';
import { CardFrame } from './CardFrame.tsx';

export interface UnitCardProps {
  def: UnitDef;
  count?: number;
}

export function UnitCard({ def, count }: UnitCardProps) {
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
      </Stack>
    </CardFrame>
  );
}

export default UnitCard;
