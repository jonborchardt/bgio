// TradeRequestSlot — renders the active TradeRequest on the center mat,
// or nothing when the slot is empty. Required + reward bags shown via
// the generic ResourceBag component. The card also hosts the "Fulfill
// trade" control: any seat with enough in their own stash can fulfill,
// paying from and receiving into their own stash. bgio enforces that
// only the currently-active seat can call moves at all, so the UI only
// gates on local-stash affordability — non-active seats simply don't
// see the click reach the engine.

import { Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { TradeRequest } from '../../game/resources/centerMat.ts';
import type {
  ResourceBag as ResourceBagType,
  Resource,
} from '../../game/resources/types.ts';
import { EMPTY_BAG, RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import type { PlayerID, SettlementState } from '../../game/types.ts';
import { ResourceBag } from '../resources/ResourceBag.tsx';

export interface TradeRequestSlotProps {
  tradeRequest: TradeRequest | null;
  G?: SettlementState;
  playerID?: PlayerID | null;
  onFulfill?: () => void;
}

const fullBag = (partial: Partial<ResourceBagType>): ResourceBagType => ({
  ...EMPTY_BAG,
  ...partial,
});

const summarizeBag = (bag: Partial<ResourceBagType>): string =>
  RESOURCES.filter((r: Resource) => (bag[r] ?? 0) > 0)
    .map((r: Resource) => `${bag[r]} ${r}`)
    .join(', ');

export function TradeRequestSlot({
  tradeRequest,
  G,
  playerID,
  onFulfill,
}: TradeRequestSlotProps) {
  if (tradeRequest === null) return null;

  const localSeat = playerID ?? undefined;
  const stash =
    G !== undefined && localSeat !== undefined
      ? G.mats?.[localSeat]?.stash
      : undefined;
  const canAffordTrade =
    stash !== undefined && canAfford(stash, tradeRequest.required);

  const fulfillReady = onFulfill !== undefined && canAffordTrade;

  const tooltip =
    localSeat === undefined
      ? 'Spectators cannot fulfill trade requests'
      : stash === undefined
        ? 'No stash available'
        : !canAffordTrade
          ? `Not enough in stash: requires ${summarizeBag(tradeRequest.required)}`
          : '';

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
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 700 }}
        >
          Trade request
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Required
          </Typography>
          <ResourceBag bag={fullBag(tradeRequest.required)} size="sm" />
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
          >
            Reward
          </Typography>
          <ResourceBag bag={fullBag(tradeRequest.reward)} size="sm" />
        </Stack>
        {onFulfill !== undefined ? (
          <Tooltip
            title={tooltip}
            placement="top"
            disableHoverListener={tooltip === ''}
          >
            <Box component="span" sx={{ display: 'inline-flex' }}>
              <Button
                size="small"
                variant="contained"
                disabled={!fulfillReady}
                onClick={onFulfill}
                aria-label="Fulfill trade request"
                sx={{
                  bgcolor: (t) => t.palette.role.foreign.main,
                  color: (t) => t.palette.role.foreign.contrastText,
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.foreign.dark,
                  },
                }}
              >
                Fulfill
              </Button>
            </Box>
          </Tooltip>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default TradeRequestSlot;
