// CenterMat (09.3) — central play area: per-player resource circles plus the
// single trade-request slot. Receives full BoardProps so it can:
//   - read circles from `G.centerMat.circles`,
//   - read tradeRequest from `G.centerMat.tradeRequest`,
//   - dispatch `pullFromMat(amounts)` when the local seat clicks its own
//     circle (V1: pulls the entire circle).
//
// Circles are laid out in a horizontal flex row; the trade-request slot sits
// alongside them. Card-table aesthetic per the plan — but we keep it simple
// (Stack) for V1 rather than absolute-positioning around a center point.

import { Box, Stack, Typography } from '@mui/material';
import type { BoardProps } from 'boardgame.io/react';
import type { SettlementState } from '../../game/types.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { rolesAtSeat } from '../../game/roles.ts';
import { Circle } from './Circle.tsx';
import { TradeRequestSlot } from './TradeRequestSlot.tsx';

// Builds a partial-bag payload of every non-zero resource in the circle, used
// by the click handler when the local seat pulls "everything" out of its own
// circle. The pullFromMat move accepts a partial bag and validates against
// canAfford internally.
const nonZeroOf = (bag: ResourceBagType): Partial<ResourceBagType> => {
  const out: Partial<ResourceBagType> = {};
  for (const [k, v] of Object.entries(bag) as [
    keyof ResourceBagType,
    number,
  ][]) {
    if (v > 0) out[k] = v;
  }
  return out;
};

export function CenterMat(props: BoardProps<SettlementState>) {
  const { G, moves, playerID } = props;
  const seats = Object.keys(G.centerMat.circles).sort();

  return (
    <Box aria-label="Center mat">
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}
      >
        {seats.map((seat) => {
          const bag = G.centerMat.circles[seat];
          if (!bag) return null;
          const isLocal =
            playerID !== undefined &&
            playerID !== null &&
            playerID === seat;
          const localRoles = isLocal
            ? rolesAtSeat(G.roleAssignments, seat)
            : [];
          // Pulling from the mat is for non-chief seats; the chief seat owns
          // no circle to begin with, so this is normally a no-op clause.
          const canPull =
            isLocal && !localRoles.includes('chief') && Object.values(bag).some((v) => v > 0);

          // Pick a role accent for the circle's border. Prefer the seat's
          // first non-chief role.
          const seatRoles = rolesAtSeat(G.roleAssignments, seat);
          const accent = seatRoles.find(
            (r): r is 'science' | 'domestic' | 'foreign' => r !== 'chief',
          );

          return (
            <Circle
              key={seat}
              seat={seat}
              bag={bag}
              canPull={canPull}
              accentRole={accent}
              onPull={
                canPull
                  ? () => {
                      moves.pullFromMat(nonZeroOf(bag));
                    }
                  : undefined
              }
            />
          );
        })}
        <TradeRequestSlot tradeRequest={G.centerMat.tradeRequest} />
      </Stack>
      {seats.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          No circles on the mat.
        </Typography>
      ) : null}
    </Box>
  );
}

export default CenterMat;
