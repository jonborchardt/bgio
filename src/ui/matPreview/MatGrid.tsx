// Grid of sample seats rendered with the active variation. Two views:
// (1) the live CenterMat 4-column arrangement using the first four
// samples — gives the designer a feel for the real layout — and
// (2) every sample state in a labeled card so edge cases (empty,
// waiting, active, chiefPhase) are visible side-by-side.

import { Box, Stack, Typography } from '@mui/material';
import { SAMPLE_SEATS } from './sampleSeats.ts';
import type { MatRenderer } from './types.ts';

export interface MatGridProps {
  Renderer: MatRenderer;
}

export function MatGrid({ Renderer }: MatGridProps) {
  return (
    <Stack spacing={4}>
      <Box>
        <SectionLabel>As the CenterMat would render</SectionLabel>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            alignItems: 'stretch',
            maxWidth: 1100,
          }}
        >
          {SAMPLE_SEATS.slice(0, 4).map((s) => (
            <Box key={s.id} sx={{ minWidth: 0, display: 'flex' }}>
              <Renderer sample={s} />
            </Box>
          ))}
        </Box>
      </Box>

      <Box>
        <SectionLabel>Every sample state</SectionLabel>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {SAMPLE_SEATS.map((s) => (
            <Stack key={s.id} spacing={0.5}>
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.status.muted,
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </Typography>
              <Box sx={{ width: '100%', display: 'flex' }}>
                <Renderer sample={s} />
              </Box>
            </Stack>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        color: (t) => t.palette.status.muted,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        mb: 1,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  );
}

export default MatGrid;
