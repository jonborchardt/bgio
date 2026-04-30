// Hand (09.5 — generic) — horizontal scrolling row of cards with an optional
// selection state. Generic over any T that exposes either an `id: string` or
// a `name: string` (used as the React key + selection identity).
//
// IMPORTANT: this file is the GENERIC reusable Hand. The Domestic role's
// panel-specific `Hand.tsx` (only takes BuildingDef[]) lives at
// `src/ui/domestic/Hand.tsx` and is the one currently wired into
// DomesticPanel. Don't conflate them.

import { Box, ButtonBase, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export interface HandProps<T> {
  cards: ReadonlyArray<T>;
  selectedID?: string;
  onSelect?: (card: T) => void;
  renderCard: (card: T) => ReactNode;
}

// Pull the identity out of a card. We accept either `id` or `name` per the
// 09.5 plan; `id` wins when both are present.
const identityOf = (card: unknown): string | undefined => {
  if (typeof card === 'object' && card !== null) {
    const c = card as { id?: unknown; name?: unknown };
    if (typeof c.id === 'string') return c.id;
    if (typeof c.name === 'string') return c.name;
  }
  return undefined;
};

export function Hand<T extends { id: string } | { name: string }>({
  cards,
  selectedID,
  onSelect,
  renderCard,
}: HandProps<T>) {
  return (
    <Stack
      direction="row"
      spacing={1}
      aria-label="Hand"
      sx={{
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        py: 0.5,
      }}
    >
      {cards.map((card, i) => {
        const id = identityOf(card) ?? String(i);
        const isSelected = selectedID !== undefined && selectedID === id;
        const child = (
          <Box
            sx={{
              scrollSnapAlign: 'start',
              transform: isSelected ? 'translateY(-0.25rem)' : 'none',
              filter: isSelected
                ? 'drop-shadow(0 0.25rem 0.5rem rgba(0,0,0,0.4))'
                : 'none',
              transition: 'transform 80ms ease-out',
            }}
          >
            {renderCard(card)}
          </Box>
        );
        if (onSelect) {
          return (
            <ButtonBase
              key={id}
              onClick={() => onSelect(card)}
              aria-pressed={isSelected}
              aria-label={`Select card ${id}`}
              sx={{ display: 'block', textAlign: 'left' }}
            >
              {child}
            </ButtonBase>
          );
        }
        return <Box key={id}>{child}</Box>;
      })}
    </Stack>
  );
}

export default Hand;
