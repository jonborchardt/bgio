// CardFrame — visual chrome shared by every typed card.
//
// The frame draws a MUI `Paper` with two purely-visual accents:
//   - `tier`: border color from `palette.tier[tier].main`.
//   - `color`: a thin top stripe colored from `palette.eventColor[color]`.
//
// Plus the cross-cutting plumbing all card components opt into:
//   - `size`: one of the five canonical card sizes (see `sizes.ts`).
//     Drives min/max width and inner padding so consumers don't repeat
//     those numbers per card kind.
//   - `cardId`: when provided, renders a small `?` overlay that opens
//     the relationships modal focused on this card. Silently no-op if
//     no `CardInfoProvider` is mounted.

import { Box, Paper, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { CardInfoButton } from './CardInfoButton.tsx';
import { CARD_HEIGHT, CARD_WIDTH, type CardSize } from './sizes.ts';

export interface CardFrameProps {
  tier?: 'beginner' | 'intermediate' | 'advanced';
  color?: 'red' | 'gold' | 'green' | 'blue';
  /** Canonical size. Defaults to `'normal'` (the existing look). */
  size?: CardSize;
  /** Stable card id (`<kind>:<name-or-id>`) used by the `?` button. */
  cardId?: string;
  /** Optional sub-id forwarded to the `?` button so the modal can
   *  highlight a specific inner element (e.g. a science cost variant). */
  highlightSubId?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

const SIZE_SX: Record<CardSize, SxProps<Theme>> = {
  micro: {
    px: 0.75,
    py: 0.25,
    minWidth: CARD_WIDTH.micro,
    minHeight: CARD_HEIGHT.micro,
  },
  small: {
    px: 0.75,
    py: 0.5,
    minWidth: CARD_WIDTH.small,
    minHeight: CARD_HEIGHT.small,
    maxWidth: CARD_WIDTH.small + 30,
  },
  normal: {
    px: 1.5,
    py: 1,
    minWidth: CARD_WIDTH.normal - 8,
    minHeight: CARD_HEIGHT.normal,
  },
  detailed: {
    px: 1.75,
    py: 1.25,
    minWidth: CARD_WIDTH.detailed - 8,
    minHeight: CARD_HEIGHT.detailed,
  },
  page: {
    px: 3,
    py: 2.5,
    minWidth: CARD_WIDTH.page,
    minHeight: CARD_HEIGHT.page,
  },
};

export function CardFrame({
  tier,
  color,
  size = 'normal',
  cardId,
  highlightSubId,
  children,
  sx,
}: CardFrameProps) {
  return (
    <Paper
      elevation={0}
      sx={[
        {
          position: 'relative',
          borderRadius: 1,
          // Always render a visible outline so the rectangle reads as a
          // distinct card on every background. Tiered cards override with
          // their tier accent; everything else falls back to a muted
          // border so a card never blends into the surface behind it.
          border: '1px solid',
          borderColor: (t) =>
            tier ? t.palette.tier[tier].main : t.palette.status.muted,
          bgcolor: (t) => t.palette.card.surface,
          color: (t) => t.palette.card.text,
          overflow: 'hidden',
          boxShadow: (t) => t.palette.shadow.card,
        },
        SIZE_SX[size],
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {color !== undefined ? (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '0.25rem',
            bgcolor: (t) => t.palette.eventColor[color].main,
          }}
        />
      ) : null}
      {cardId !== undefined ? (
        <CardInfoButton
          cardId={cardId}
          size={size}
          highlightSubId={highlightSubId}
        />
      ) : null}
      <Stack spacing={0.5} sx={{ pt: color !== undefined ? 0.5 : 0 }}>
        {children}
      </Stack>
    </Paper>
  );
}

export default CardFrame;
