// DeckStack (09.5) — face-down stack with a count badge and an optional
// face-up top card. Generic over any card type T; `cards` may contain `null`
// entries for redacted (face-down) positions.
//
// When `renderTop` is provided AND `cards[0] !== null`, we render the top
// face-up via `renderTop(cards[0])`. Otherwise we draw a face-down CardFrame.
// The whole stack is clickable when `onClick` is set (used to flip).

import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { CardFrame } from '../cards/CardFrame.tsx';

export interface DeckStackProps<T> {
  cards: ReadonlyArray<T | null>;
  renderTop?: (card: T) => ReactNode;
  onClick?: () => void;
  label?: string;
}

export function DeckStack<T>({
  cards,
  renderTop,
  onClick,
  label,
}: DeckStackProps<T>) {
  const top = cards[0];
  const showFaceUp = renderTop !== undefined && top !== null && top !== undefined;

  const inner = (
    <Stack spacing={0.5} aria-label={label ?? 'Deck stack'}>
      {label !== undefined ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
        >
          {label}
        </Typography>
      ) : null}
      <Box>
        {showFaceUp ? (
          renderTop(top as T)
        ) : (
          <CardFrame>
            <Box
              aria-label="Face-down deck top"
              sx={{
                minHeight: '4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: (t) => t.palette.status.muted,
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              ?
            </Box>
          </CardFrame>
        )}
      </Box>
      <Typography
        variant="caption"
        aria-label="Deck count"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
      >
        {cards.length} card{cards.length === 1 ? '' : 's'}
      </Typography>
    </Stack>
  );

  if (onClick) {
    return (
      <ButtonBase
        onClick={onClick}
        sx={{ display: 'block', textAlign: 'left' }}
        aria-label={label ? `Flip ${label}` : 'Flip deck'}
      >
        {inner}
      </ButtonBase>
    );
  }
  return <Box>{inner}</Box>;
}

export default DeckStack;
