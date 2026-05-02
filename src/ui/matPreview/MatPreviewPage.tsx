// Player-mat design preview page.
//
// Reachable in any build via the `#mats` URL hash. Renders a tab strip
// of variations and a grid below showing every sample seat state under
// the active variation's renderer. Mirrors the `#cards` workshop.

import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { MatGrid } from './MatGrid.tsx';
import { VARIATIONS } from './variations/index.ts';

export function MatPreviewPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = VARIATIONS[activeIdx] ?? VARIATIONS[0];

  const onBack = () => {
    if (typeof window === 'undefined') return;
    window.location.hash = '';
    window.location.reload();
  };

  if (active === undefined) return null;

  return (
    <Box sx={{ minHeight: '100vh', p: 3 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'flex-start', mb: 2 }}
      >
        <Stack spacing={0.25} sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Player-mat tile preview
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Five embossed-zone designs for the per-seat tile on the
            CenterMat. Title and waiting-for caption are unchanged; the
            old "Income / Stash" text labels are replaced by zoned
            embossed glyphs.
          </Typography>
        </Stack>
        <Button variant="outlined" size="small" onClick={onBack}>
          ← Back to game
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          flexWrap: 'wrap',
          rowGap: 1,
          mb: 1,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: (t) => t.palette.status.muted,
        }}
      >
        {VARIATIONS.map((v, i) => {
          const selected = i === activeIdx;
          return (
            <Button
              key={v.id}
              variant={selected ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setActiveIdx(i)}
              sx={{ textTransform: 'none' }}
            >
              {v.name}
            </Button>
          );
        })}
      </Stack>

      <Typography
        variant="body2"
        sx={{
          color: (t) => t.palette.status.muted,
          fontStyle: 'italic',
          mb: 3,
        }}
      >
        {active.blurb}
      </Typography>

      <MatGrid Renderer={active.Renderer} />
    </Box>
  );
}

export default MatPreviewPage;
