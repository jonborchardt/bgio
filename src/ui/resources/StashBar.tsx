// StashBar — compact "Stash: <token> <token> …" row used by every role
// panel. Resources are rendered as the same coloured square + subscript
// initial used inside cards (cost rows, adjacency lines), so the player
// mat reads as the canonical resource token everywhere it appears. The
// hover title (`<count> <resource>`) is supplied by `ResourceToken`.

import { Stack, Typography } from '@mui/material';
import {
  EMPTY_BAG,
  RESOURCES,
} from '../../game/resources/types.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { ResourceToken } from './ResourceToken.tsx';

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
      spacing={0.6}
      aria-label={ariaLabel}
      sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 0.5 }}
    >
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600, mr: 0.25 }}
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
          <ResourceToken key={r} resource={r} count={bag[r]} size="detailed" />
        ))
      )}
    </Stack>
  );
}

export default StashBar;
