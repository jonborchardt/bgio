// Domestic Hand (06.7) — horizontal row of building cards the Domestic seat
// can buy & place. The selected card paints filled; siblings paint outlined.
// V1 selection model: panel-local React state owns a `selectedName?: string`,
// passed in here. Clicking a card calls `onSelect(name)`; the panel decides
// whether that means "begin placing" or "deselect".

import { Button, Stack } from '@mui/material';
import type { BuildingDef } from '../../data/schema.ts';

export interface HandProps {
  hand: BuildingDef[];
  selectedName?: string;
  onSelect: (name: string) => void;
}

export function Hand({ hand, selectedName, onSelect }: HandProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      aria-label="Domestic hand"
      sx={{ flexWrap: 'wrap', rowGap: 1 }}
    >
      {hand.length === 0 ? null : (
        hand.map((card) => {
          const isSelected = card.name === selectedName;
          return (
            <Button
              key={card.name}
              size="small"
              variant={isSelected ? 'contained' : 'outlined'}
              onClick={() => onSelect(card.name)}
              aria-label={`Select building ${card.name}`}
              aria-pressed={isSelected}
              sx={{
                bgcolor: (t) =>
                  isSelected ? t.palette.role.domestic.main : 'transparent',
                color: (t) =>
                  isSelected
                    ? t.palette.role.domestic.contrastText
                    : t.palette.role.domestic.main,
                borderColor: (t) => t.palette.role.domestic.main,
                '&:hover': {
                  bgcolor: (t) =>
                    isSelected
                      ? t.palette.role.domestic.dark
                      : t.palette.card.surface,
                },
              }}
            >
              {card.name} ({card.cost}g)
            </Button>
          );
        })
      )}
    </Stack>
  );
}

export default Hand;
