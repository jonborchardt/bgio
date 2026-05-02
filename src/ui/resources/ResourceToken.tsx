// Shared coloured resource token: a small square showing the count, with
// the resource's initial as a subscript and the full "<count> <resource>"
// string surfaced on hover (native title — no MUI Tooltip needed for the
// dense bar use case). Used both inside cards (cost rows, adjacency
// bonuses) and on the player mat / stash bar.

import { Box } from '@mui/material';
import type { CardSize } from '../cards/sizes.ts';

export interface ResourceTokenProps {
  resource: string;
  count: number;
  /** Card-relative size keyword. Defaults to `'normal'`. The stash bar
   *  passes `'detailed'` to get a slightly larger pill that's legible at
   *  panel scale. */
  size?: CardSize;
}

const DIM_BY_SIZE: Record<CardSize, number> = {
  micro: 12,
  small: 14,
  normal: 18,
  detailed: 22,
  page: 28,
};

export function ResourceToken({
  resource,
  count,
  size = 'normal',
}: ResourceTokenProps) {
  const dim = DIM_BY_SIZE[size];
  const initial = resource.charAt(0).toUpperCase();
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        width: dim,
        height: dim,
        borderRadius: 0.4,
        bgcolor: t.palette.resource[resource as 'gold'].main,
        border: `1px solid ${t.palette.resource[resource as 'gold'].dark}`,
        color: t.palette.resource[resource as 'gold'].contrastText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: dim * 0.55,
        lineHeight: 1,
        flexShrink: 0,
      })}
      title={`${count} ${resource}`}
    >
      {count}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          bottom: -1,
          right: 1,
          fontSize: dim * 0.32,
          fontWeight: 700,
          opacity: 0.85,
        }}
      >
        {initial}
      </Box>
    </Box>
  );
}

export default ResourceToken;
