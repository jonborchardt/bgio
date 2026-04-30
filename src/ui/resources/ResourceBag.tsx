// ResourceBag (09.3) — horizontal row of ResourceChips for any
// `ResourceBag`. Defaults to hiding zero-count resources; pass
// `hideZero={false}` to render every slot for a fixed-width summary.
//
// Iterates RESOURCES (not Object.keys) so the chip order is deterministic
// and matches the canonical resource ordering used elsewhere.

import { Stack } from '@mui/material';
import { RESOURCES } from '../../game/resources/types.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { ResourceChip, type ChipSize } from './ResourceChip.tsx';

export interface ResourceBagProps {
  bag: ResourceBagType;
  hideZero?: boolean;
  size?: ChipSize;
}

export function ResourceBag({
  bag,
  hideZero = true,
  size = 'md',
}: ResourceBagProps) {
  const visible = RESOURCES.filter((r) => (hideZero ? bag[r] > 0 : true));
  return (
    <Stack
      direction="row"
      spacing={0.5}
      aria-label="Resource bag"
      sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
    >
      {visible.map((resource) => (
        <ResourceChip
          key={resource}
          resource={resource}
          count={bag[resource]}
          size={size}
        />
      ))}
    </Stack>
  );
}

export default ResourceBag;
