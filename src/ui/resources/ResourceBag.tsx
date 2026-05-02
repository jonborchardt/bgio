// ResourceBag — horizontal row of resource tokens for any `ResourceBag`.
// Defaults to hiding zero-count resources; pass `hideZero={false}` to
// render every slot for a fixed-width summary.
//
// Iterates RESOURCES (not Object.keys) so the token order is deterministic
// and matches the canonical resource ordering used elsewhere.
//
// Tokens are the canonical card token (coloured square + count + initial
// + native hover title) so the player mat reads as the same visual
// language as the cards it supports.

import { Stack } from '@mui/material';
import { RESOURCES } from '../../game/resources/types.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { ResourceToken } from './ResourceToken.tsx';
import type { CardSize } from '../cards/sizes.ts';

export interface ResourceBagProps {
  bag: ResourceBagType;
  hideZero?: boolean;
  size?: CardSize;
}

export function ResourceBag({
  bag,
  hideZero = true,
  size = 'normal',
}: ResourceBagProps) {
  const visible = RESOURCES.filter((r) => (hideZero ? bag[r] > 0 : true));
  return (
    <Stack
      direction="row"
      spacing={0.5}
      aria-label="Resource bag"
      sx={{ flexWrap: 'wrap', alignItems: 'center', rowGap: 0.5 }}
    >
      {visible.map((resource) => (
        <ResourceToken
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
