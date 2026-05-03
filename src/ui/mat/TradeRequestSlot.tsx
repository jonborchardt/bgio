// TradeRequestSlot — chief-only "trade requests" panel section.
//
// Lives inside the ChiefPanel under the "Cards" row. Two states:
//
//   - empty: no trade request parked. Renders the section heading plus an
//     EmbossedFrame with the placeholder line "Awaiting a trade request —
//     win a battle and flip a Trade card on the Foreign turn." Mirrors
//     the empty-hand styling used by `<PlayableHand>`.
//
//   - active: a TradeCard-style frame showing the required / reward bags,
//     plus a "Fulfill" button. The chief pays `required` from `G.bank`
//     and receives `reward` back into the bank. The button is disabled
//     when not in chiefPhase or when the bank can't cover `required`.
//
// Non-chief seats never see the contents — `playerView` redacts
// `centerMat.tradeRequest` to `null` for them — so this component is
// only mounted from inside ChiefPanel.

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { TradeRequest } from '../../game/resources/centerMat.ts';
import type {
  ResourceBag as ResourceBagType,
  Resource,
} from '../../game/resources/types.ts';
import { RESOURCES } from '../../game/resources/types.ts';
import { canAfford } from '../../game/resources/bag.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { SectionHeading } from '../layout/SectionHeading.tsx';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';
import { CardFrame } from '../cards/CardFrame.tsx';

export interface TradeRequestSlotProps {
  /** The active trade request, or `null` when no card is parked. */
  tradeRequest: TradeRequest | null;
  /** The chief's funds (i.e., `G.bank`). When the bank can't cover
   *  `required`, the Fulfill button is disabled with an explanatory
   *  tooltip. Optional so the component can render a "no funds context"
   *  empty state without crashing. */
  bank?: ResourceBagType;
  /** True when it is the chief's turn to act (i.e., `chiefPhase`). When
   *  false the Fulfill button is disabled. */
  canAct: boolean;
  /** Click handler for the Fulfill button. When omitted the button is
   *  rendered but disabled (read-only mode for spectators / replays). */
  onFulfill?: () => void;
}

const renderBagIcons = (bag: Partial<ResourceBagType>): ReactNode => {
  const entries = RESOURCES.filter((r: Resource) => (bag[r] ?? 0) > 0);
  if (entries.length === 0) return null;
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
    >
      {entries.map((r) => (
        <ResourceToken key={r} resource={r} count={bag[r]!} size="small" />
      ))}
    </Box>
  );
};

export function TradeRequestSlot({
  tradeRequest,
  bank,
  canAct,
  onFulfill,
}: TradeRequestSlotProps) {
  if (tradeRequest === null) {
    return (
      <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
        <SectionHeading role="chief">Trade Requests</SectionHeading>
        <EmbossedFrame
          role="chief"
          sx={{
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 0.25,
            py: 2,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
            }}
          >
            Awaiting a trade request.
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
            }}
          >
            Foreign must win a battle and flip a Trade card.
          </Typography>
        </EmbossedFrame>
      </Stack>
    );
  }

  const canAffordTrade =
    bank !== undefined && canAfford(bank, tradeRequest.required);
  const fulfillReady =
    onFulfill !== undefined && canAct && canAffordTrade;

  const tooltip: ReactNode = !canAct
    ? 'Wait for the Chief phase to fulfill'
    : !canAffordTrade
      ? (
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}
          >
            Bank can't cover required: needs {renderBagIcons(tradeRequest.required)}
          </Box>
        )
      : '';

  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <SectionHeading role="chief">Trade Requests</SectionHeading>
      <Stack
        direction="row"
        spacing={1.25}
        aria-label="Trade request"
        sx={{ flexWrap: 'wrap', rowGap: 1.25, alignItems: 'stretch' }}
      >
        <Stack spacing={0.5} sx={{ alignItems: 'stretch' }}>
          <CardFrame size="normal">
            <Stack spacing={0.75}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Trade Request
              </Typography>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.status.muted,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontSize: '0.65rem',
                  }}
                >
                  Required
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.25 }}>
                  {RESOURCES.filter(
                    (r) => (tradeRequest.required[r] ?? 0) > 0,
                  ).map((r) => (
                    <ResourceToken
                      key={r}
                      resource={r}
                      count={tradeRequest.required[r] ?? 0}
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: (t) => t.palette.status.muted,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontSize: '0.65rem',
                  }}
                >
                  Reward
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.25 }}>
                  {RESOURCES.filter(
                    (r) => (tradeRequest.reward[r] ?? 0) > 0,
                  ).map((r) => (
                    <ResourceToken
                      key={r}
                      resource={r}
                      count={tradeRequest.reward[r] ?? 0}
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </CardFrame>
          <Tooltip
            title={tooltip}
            placement="bottom"
            disableHoverListener={tooltip === ''}
          >
            <Box>
              <Button
                size="small"
                variant="contained"
                disabled={!fulfillReady}
                onClick={onFulfill}
                aria-label="Fulfill trade request"
                sx={{
                  width: '100%',
                  bgcolor: (t) => t.palette.role.chief.main,
                  color: (t) => t.palette.role.chief.contrastText,
                  '&:hover': {
                    bgcolor: (t) => t.palette.role.chief.dark,
                  },
                }}
              >
                Fulfill
              </Button>
            </Box>
          </Tooltip>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default TradeRequestSlot;
