// Gameboard layout preview page.
//
// Reachable in any build via the `#boards` URL hash. Mirrors the
// `#cards` and `#mats` workshop pattern: a thin self-contained page
// that doesn't mount a bgio Client and can't affect a running match.
//
// Five "boards" are surveyed (central + the four role panels). For
// each board, five layout candidates are rendered side-by-side as a
// grid, each with its blurb describing the design intent.

import { Box, Button, Stack, Typography } from '@mui/material';
import { BOARD_SECTIONS } from './layouts/index.ts';
import type { LayoutDef } from './types.ts';

export function BoardPreviewPage() {
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
        sx={{ alignItems: 'flex-start', mb: 3 }}
      >
        <Stack spacing={0.25} sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Gameboard layout preview
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Five layout-only candidates per board (central + the four
            role panels). Each schematic uses placeholder slots — only
            the spatial arrangement is the proposal. Sub-components
            inside each slot are unchanged unless explicitly noted.
          </Typography>
        </Stack>
        <Button variant="outlined" size="small" onClick={onBack}>
          ← Back to game
        </Button>
      </Stack>

      <Stack spacing={5}>
        {BOARD_SECTIONS.map((section) => (
          <Box key={section.kind} component="section">
            <Stack
              spacing={0.25}
              sx={{
                mb: 2,
                pb: 1,
                borderBottom: '1px solid',
                borderColor: (t) => t.palette.status.muted,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {section.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted }}
              >
                {section.intro}
              </Typography>
            </Stack>
            <LayoutColumns layouts={section.layouts} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function LayoutColumns({ layouts }: { layouts: ReadonlyArray<LayoutDef> }) {
  return (
    <Box
      sx={{
        display: 'grid',
        // Each candidate gets a fixed-ish column. 5 columns flex to
        // fit but never collapse below ~340px so the schematics stay
        // readable. Wraps onto a second row on narrower viewports.
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {layouts.map((layout) => (
        <Stack
          key={layout.id}
          spacing={0.75}
          sx={{ minWidth: 0, height: '100%' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {layout.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              minHeight: '3.4em',
            }}
          >
            {layout.blurb}
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            <layout.Render />
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

export default BoardPreviewPage;
