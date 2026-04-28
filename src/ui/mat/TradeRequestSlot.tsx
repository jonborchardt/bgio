// TradeRequestSlot (09.3) — renders the active TradeRequest on the center mat,
// or nothing when the slot is empty. Required + reward bags shown via the
// generic ResourceBag component.

import { Paper, Stack, Typography } from '@mui/material';
import type { TradeRequest } from '../../game/resources/centerMat.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { ResourceBag } from '../resources/ResourceBag.tsx';

export interface TradeRequestSlotProps {
  tradeRequest: TradeRequest | null;
}

// The TradeRequest's required/reward fields are typed as full ResourceBag, but
// callers might pass a Partial in practice — fold the partial onto a fresh
// EMPTY shape so ResourceBag can iterate every key safely.
const fullBag = (partial: Partial<ResourceBagType>): ResourceBagType => ({
  ...EMPTY_BAG,
  ...partial,
});

export function TradeRequestSlot({ tradeRequest }: TradeRequestSlotProps) {
  if (tradeRequest === null) return null;
  return (
    <Paper
      elevation={0}
      aria-label="Trade request"
      sx={{
        px: 1.5,
        py: 1,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.foreign.main,
        borderRadius: 1,
        minWidth: '12rem',
      }}
    >
      <Stack spacing={0.75}>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
        >
          Trade request
        </Typography>
        <Stack spacing={0.25}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Required
          </Typography>
          <ResourceBag bag={fullBag(tradeRequest.required)} size="sm" />
        </Stack>
        <Stack spacing={0.25}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Reward
          </Typography>
          <ResourceBag bag={fullBag(tradeRequest.reward)} size="sm" />
        </Stack>
      </Stack>
    </Paper>
  );
}

export default TradeRequestSlot;
