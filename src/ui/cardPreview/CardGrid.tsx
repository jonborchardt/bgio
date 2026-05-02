// Shared grid that renders every (sample card × size) pair using the
// active variation's Renderer. Variations only own their per-card visual
// language; layout / labels / size column widths live here.

import { Box, Stack, Typography } from '@mui/material';
import { CARD_WIDTH } from '../cards/sizes.ts';
import { SAMPLE_CARDS, SAMPLE_KINDS } from './sampleCards.ts';
import {
  PREVIEW_SIZES,
  PREVIEW_SIZE_LABELS,
  SAMPLE_LABELS,
  type Renderer,
} from './types.ts';

export interface CardGridProps {
  Renderer: Renderer;
}

export function CardGrid({ Renderer }: CardGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        // First column = label; remaining columns sized by the canonical
        // pixel-width hints from sizes.ts so cards don't overflow.
        gridTemplateColumns: `170px ${PREVIEW_SIZES.map(
          (s) => `${CARD_WIDTH[s] + 24}px`,
        ).join(' ')}`,
        rowGap: 3,
        columnGap: 3,
        alignItems: 'start',
      }}
    >
      {/* Header row */}
      <Box />
      {PREVIEW_SIZES.map((size) => (
        <Typography
          key={size}
          variant="caption"
          sx={{
            color: (t) => t.palette.status.muted,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            pb: 1,
            borderBottom: '1px solid',
            borderColor: (t) => t.palette.status.muted,
          }}
        >
          {PREVIEW_SIZE_LABELS[size]} · {size}
        </Typography>
      ))}

      {/* Body rows: one per sample kind */}
      {SAMPLE_KINDS.map((kind) => {
        const card = SAMPLE_CARDS[kind];
        return (
          <RowCells key={kind} kind={kind} card={card} Renderer={Renderer} />
        );
      })}
    </Box>
  );
}

function RowCells({
  kind,
  card,
  Renderer,
}: {
  kind: keyof typeof SAMPLE_LABELS;
  card: (typeof SAMPLE_CARDS)[keyof typeof SAMPLE_CARDS];
  Renderer: Renderer;
}) {
  return (
    <>
      <Stack spacing={0.25} sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {SAMPLE_LABELS[kind]}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, lineHeight: 1.3 }}
        >
          {kind}
        </Typography>
      </Stack>
      {PREVIEW_SIZES.map((size) => (
        <Box key={size} sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Renderer card={card} size={size} />
        </Box>
      ))}
    </>
  );
}

export default CardGrid;
