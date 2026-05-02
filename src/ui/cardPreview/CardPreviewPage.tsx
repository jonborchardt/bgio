// Card-design preview page.
//
// Reachable in any build via the `#cards` URL hash. Renders a tab strip
// across the top — one tab per variation under ./variations/ — and a
// grid below showing every sample card at every preview size.
//
// The page is intentionally separate from the running game (no bgio
// Client mounted, no setupData required) so it loads instantly and
// nothing here can affect a real match.

import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { CardGrid } from './CardGrid.tsx';
import { VARIATIONS } from './variations/index.ts';

export function CardPreviewPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = VARIATIONS[activeIdx] ?? VARIATIONS[0];

  const onBack = () => {
    if (typeof window === 'undefined') return;
    window.location.hash = '';
    // Force a refresh so the App's hash check runs again — App reads
    // the hash on first render, not via a listener.
    window.location.reload();
  };

  return (
    <Box sx={{ minHeight: '100vh', p: 3 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'flex-start', mb: 2 }}
      >
        <Stack spacing={0.25} sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Card design preview
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Six sample cards × four sizes per variation. Tabs below switch
            visual languages so you can compare side-by-side.
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

      <CardGrid Renderer={active.Renderer} />
    </Box>
  );
}

export default CardPreviewPage;
