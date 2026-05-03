// Shared coloured resource token: a small square showing the count, with
// the resource's symbol as a subscript and the full "<count> <name>"
// string surfaced on hover (native title — no MUI Tooltip needed for the
// dense bar use case). Used both inside cards (cost rows, adjacency
// bonuses) and on the player mat / stash bar.
//
// The rendered symbol and tooltip name come from `RESOURCE_DISPLAY` —
// not `resource.charAt(0)` — so first-letter collisions resolve cleanly
// (steel=T, science=C, worker/Labor=L, happiness/Approval=A).
//
// Pass `count` to render a counted token (the cost / stash use). Omit it
// to render an icon-only swatch — the symbol fills the square and the
// hover title shows just the resource name. The icon-only variant is
// the canonical "this is a wood slot" / "this row controls gold"
// affordance — anywhere we'd otherwise spell the resource's name in text.

import { Box } from '@mui/material';
import {
  RESOURCE_DISPLAY,
  type Resource,
} from '../../game/resources/types.ts';
import type { CardSize } from '../cards/sizes.ts';

export interface ResourceTokenProps {
  resource: string;
  /** When omitted, renders an icon-only swatch (the symbol fills the
   *  square) for type-only references. */
  count?: number;
  /** Sign prefix for the count, e.g. '+' for "+1 Approval". Ignored when
   *  `count` is omitted. */
  sign?: '+' | '-' | '';
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
};

export function ResourceToken({
  resource,
  count,
  sign = '',
  size = 'normal',
}: ResourceTokenProps) {
  const dim = DIM_BY_SIZE[size];
  const display = RESOURCE_DISPLAY[resource as Resource];
  const symbol = display?.symbol ?? resource.charAt(0).toUpperCase();
  const name = display?.name ?? resource;
  const counted = count !== undefined;
  const text = counted ? `${sign}${count}` : symbol;
  const title = counted ? `${sign}${count} ${name}` : name;
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
        fontSize: dim * (counted ? 0.55 : 0.7),
        lineHeight: 1,
        flexShrink: 0,
      })}
      title={title}
    >
      {text}
      {counted ? (
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
          {symbol}
        </Box>
      ) : null}
    </Box>
  );
}

export default ResourceToken;
