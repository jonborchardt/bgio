// StashBar — compact "Stash: <dot> resource: count …" row used by every
// role panel. Only resources with a positive count appear; if the seat
// holds nothing, an em dash is shown.

import { Box, Stack, Typography } from '@mui/material';
import {
  EMPTY_BAG,
  RESOURCES,
} from '../../game/resources/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';

export interface StashBarProps {
  stash?: ResourceBag;
  ariaLabel?: string;
  label?: string;
}

export function StashBar({
  stash,
  ariaLabel = 'Stash',
  label = 'Stash',
}: StashBarProps) {
  const bag = stash ?? EMPTY_BAG;
  const held = RESOURCES.filter((r) => (bag[r] ?? 0) > 0);

  return (
    <Stack
      direction="row"
      spacing={1}
      aria-label={ariaLabel}
      sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 0.5 }}
    >
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
      >
        {label}:
      </Typography>
      {held.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          —
        </Typography>
      ) : (
        held.map((r) => (
          <Stack
            key={r}
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center' }}
          >
            <Box
              aria-hidden
              sx={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                bgcolor: (t) => t.palette.resource[r].main,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: (t) => t.palette.resource[r].main,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {r}: {bag[r]}
            </Typography>
          </Stack>
        ))
      )}
    </Stack>
  );
}

export default StashBar;
