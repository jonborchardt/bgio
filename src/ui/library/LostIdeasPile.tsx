// Science Library SL 5.3 — LostIdeasPile.
//
// The public burn pile on the central board: every science card a seat
// chose to burn instead of buying ends up here, face-up, forever. It's
// the only narrative surface in the redesign — a visible record of
// paths the village will never take. Always rendered; clicking expands
// into a Dialog grouped by color, sorted by tier within color.

import { useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type { LibraryCard } from '../../game/library/types.ts';
import type { LibraryColor } from '../../data/schema.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { LibraryCardTile } from './LibraryCardTile.tsx';

export interface LostIdeasPileProps {
  lostIdeas: ReadonlyArray<LibraryCard>;
}

const COLOR_ORDER: ReadonlyArray<LibraryColor> = [
  'gold',
  'blue',
  'green',
  'red',
];

const COLOR_LABEL: Record<LibraryColor, string> = {
  gold: 'Gold',
  blue: 'Blue',
  green: 'Green',
  red: 'Red',
};

const noopSlot = (): void => undefined;

function PileTile({ card, slotIndex }: { card: LibraryCard; slotIndex: number }) {
  return (
    <LibraryCardTile
      card={card}
      slotIndex={slotIndex}
      effectiveCost={EMPTY_BAG}
      viewerStash={EMPTY_BAG}
      canAct={false}
      viewerIsScience={false}
      onBuy={noopSlot}
      onBurn={noopSlot}
      compact
    />
  );
}

export function LostIdeasPile({ lostIdeas }: LostIdeasPileProps) {
  const [open, setOpen] = useState(false);
  const count = lostIdeas.length;
  const top = count > 0 ? lostIdeas[count - 1]! : null;

  // Group by color, sort by tier within color. Stable across renders so
  // dialog ordering never jitters when the same pile is re-opened.
  const grouped = useMemo(() => {
    const buckets: Record<LibraryColor, LibraryCard[]> = {
      gold: [],
      blue: [],
      green: [],
      red: [],
    };
    for (const card of lostIdeas) buckets[card.scienceColor].push(card);
    for (const color of COLOR_ORDER) {
      buckets[color].sort((a, b) => a.tier - b.tier);
    }
    return buckets;
  }, [lostIdeas]);

  const ariaLabel = `View the ${count} cards the village never discovered.`;

  if (count === 0) {
    return (
      <Box
        data-testid="lost-ideas-pile"
        data-count="0"
        sx={{
          minWidth: 132,
          minHeight: 88,
          p: 1,
          borderRadius: 1,
          border: '1px dashed',
          borderColor: (t) => t.palette.status.muted,
          bgcolor: (t) => t.palette.appSurface.base,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.55,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          no ideas lost
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <ButtonBase
        data-testid="lost-ideas-pile"
        data-count={count}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        sx={{
          position: 'relative',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          p: 0.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: (t) => t.palette.status.muted,
          bgcolor: (t) => t.palette.appSurface.base,
          boxShadow: (t) => t.palette.shadow.card,
          textAlign: 'left',
          '&:hover': {
            borderColor: (t) => t.palette.status.active,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: (t) => t.palette.status.muted,
            mb: 0.25,
          }}
        >
          Lost ideas
        </Typography>
        {top !== null && <PileTile card={top} slotIndex={count - 1} />}
        <Box
          data-testid="lost-ideas-count"
          sx={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 22,
            height: 22,
            px: 0.5,
            borderRadius: '11px',
            bgcolor: (t) => t.palette.role.defense.main,
            color: (t) => t.palette.role.defense.contrastText,
            fontSize: '0.7rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: (t) => t.palette.shadow.card,
          }}
        >
          {count}
        </Box>
      </ButtonBase>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="lost-ideas-dialog-title"
      >
        <DialogTitle
          id="lost-ideas-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700,
          }}
        >
          Lost ideas ({count})
          <IconButton
            aria-label="Close lost ideas"
            size="small"
            onClick={() => setOpen(false)}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {COLOR_ORDER.map((color) => {
              const cards = grouped[color];
              if (cards.length === 0) return null;
              return (
                <Box
                  key={color}
                  data-testid={`lost-ideas-group-${color}`}
                  data-group-count={cards.length}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.5,
                      fontSize: '0.65rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: (t) => t.palette.eventColor[color].light,
                    }}
                  >
                    {COLOR_LABEL[color]} ({cards.length})
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      flexWrap: 'wrap',
                      rowGap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    {cards.map((card, i) => (
                      <PileTile
                        key={`${card.kind}-${card.def.name}-${i}`}
                        card={card}
                        slotIndex={i}
                      />
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default LostIdeasPile;
