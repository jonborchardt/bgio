// Five layout candidates for the table-shared CentralBoard.
//
// All schematics use placeholder slots only — no live game state. The
// real components a layout would wire in (TrackStrip, BuildingGrid,
// ProgressBoxes, LostIdeasPile, ResolveStepBanner) are referenced in
// the slot labels so a reviewer reads them at a glance.
//
// React-refresh's only-export-components rule wants component-only
// files; this preview registry intentionally co-locates layout
// components with the exported `LAYOUTS` array, since splitting 25
// schematics into 25 files would dwarf the preview itself. The
// preview page reloads whole on hash change — Fast Refresh isn't a
// concern here.

/* eslint-disable react-refresh/only-export-components */

import { Box, Paper, Stack, Typography } from '@mui/material';
import { Slot } from '../Slot.tsx';
import type { LayoutDef } from '../types.ts';

function CentralFrame({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        bgcolor: (t) => t.palette.card.surface,
        minWidth: 0,
      }}
    >
      <Typography
        component="h2"
        variant="subtitle2"
        sx={{
          fontWeight: 800,
          letterSpacing: '0.06em',
          textAlign: 'center',
          mb: 0.75,
        }}
      >
        SETTLEMENT
      </Typography>
      {children}
    </Paper>
  );
}

// --- 1. Side-gutters (live, today) ---------------------------------
function CentralSideGutters() {
  return (
    <CentralFrame>
      <Stack spacing={1}>
        <Slot label="Track strip" note="10 phases · boss tail" minHeight={64} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr auto 1fr',
            columnGap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Box aria-hidden />
          <Slot
            label="Village"
            note="3×3 grid · units stack on tiles"
            emphasis="hero"
            minHeight={220}
            sx={{ width: 220 }}
          />
          <Box aria-hidden />
          <Stack spacing={0.75} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={0.75}>
              <Slot label="Science" note="boss thr." minHeight={56} sx={{ width: 80 }} />
              <Slot label="Economy" note="boss thr." minHeight={56} sx={{ width: 80 }} />
            </Stack>
            <Slot label="Lost ideas" note="public burn pile" minHeight={56} />
          </Stack>
          <Box aria-hidden />
        </Box>
      </Stack>
    </CentralFrame>
  );
}

// --- 2. Stacked-column ---------------------------------------------
// Track on top, village centred, all telemetry tucked into one
// horizontal "dashboard strip" right under the village so the central
// frame feels like one tall column instead of a T.
function CentralStackedColumn() {
  return (
    <CentralFrame>
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <Slot label="Track strip" minHeight={64} sx={{ width: '100%' }} />
        <Slot
          label="Village"
          note="3×3 grid"
          emphasis="hero"
          minHeight={220}
          sx={{ width: 240 }}
        />
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ width: '100%', justifyContent: 'space-between' }}
        >
          <Slot label="Science" note="thr." minHeight={48} sx={{ flex: 1 }} />
          <Slot label="Economy" note="thr." minHeight={48} sx={{ flex: 1 }} />
          <Slot
            label="Lost ideas"
            note="burn pile"
            minHeight={48}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Stack>
    </CentralFrame>
  );
}

// --- 3. Boss-anchored (track ➜ trackers ➜ village) ------------------
// Treat the boss telegraph as the headline: trackers sit *under* the
// track strip in a wide bar so the table reads "what's coming" before
// "where to put things". Village drops below as the action surface.
function CentralBossAnchored() {
  return (
    <CentralFrame>
      <Stack spacing={1}>
        <Slot label="Track strip" note="phases →" minHeight={64} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            columnGap: 1,
          }}
        >
          <Slot
            label="Science thr."
            note="N / target"
            minHeight={64}
            emphasis="muted"
          />
          <Slot
            label="Economy thr."
            note="high / target"
            minHeight={64}
            emphasis="muted"
          />
          <Slot
            label="Lost ideas"
            note="burn pile"
            minHeight={64}
            emphasis="muted"
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            columnGap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Box aria-hidden />
          <Slot
            label="Village"
            note="3×3 grid · units · paths"
            emphasis="hero"
            minHeight={220}
            sx={{ width: 240 }}
          />
          <Box aria-hidden />
        </Box>
      </Stack>
    </CentralFrame>
  );
}

// --- 4. Two-column "ledger" ----------------------------------------
// Village on the left at full height, all telemetry in a tall right
// rail. Trackers + lost-ideas + a reserved Boss readout slot stack
// vertically — feels like the village has a control panel beside it.
function CentralTwoColumn() {
  return (
    <CentralFrame>
      <Stack spacing={1}>
        <Slot label="Track strip" minHeight={56} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: 1.25,
            alignItems: 'flex-start',
          }}
        >
          <Slot
            label="Village"
            note="3×3 grid"
            emphasis="hero"
            minHeight={260}
            sx={{ width: 240 }}
          />
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Slot label="Boss readout" note="name · phase" minHeight={48} />
            <Slot label="Science thr." minHeight={48} />
            <Slot label="Economy thr." minHeight={48} />
            <Slot label="Lost ideas" note="burn pile" minHeight={56} />
          </Stack>
        </Box>
      </Stack>
    </CentralFrame>
  );
}

// --- 5. Wrap-around track ------------------------------------------
// Village dead-centre, ringed by a track that wraps three sides:
// past-on-left, current-on-top, upcoming-on-right. Trackers tuck
// under the village as a single-row strip. Heaviest layout, but the
// "the world wraps the village" reading is unique.
function CentralWrapAround() {
  return (
    <CentralFrame>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gridTemplateRows: 'auto auto auto',
          gap: 0.75,
          alignItems: 'stretch',
        }}
      >
        <Slot
          label="Track ←"
          note="past phases"
          minHeight={220}
          sx={{ gridRow: '1 / span 2', width: 70, writingMode: 'vertical-rl' }}
        />
        <Slot label="Track ↑" note="current card" minHeight={56} />
        <Slot
          label="Track →"
          note="upcoming · boss"
          minHeight={220}
          sx={{ gridRow: '1 / span 2', width: 70, writingMode: 'vertical-rl' }}
        />
        <Slot
          label="Village"
          note="3×3 grid"
          emphasis="hero"
          minHeight={220}
        />
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ gridColumn: '1 / span 3' }}
        >
          <Slot label="Science thr." minHeight={48} sx={{ flex: 1 }} />
          <Slot label="Economy thr." minHeight={48} sx={{ flex: 1 }} />
          <Slot label="Lost ideas" minHeight={48} sx={{ flex: 1 }} />
        </Stack>
      </Box>
    </CentralFrame>
  );
}

export const CENTRAL_LAYOUTS: ReadonlyArray<LayoutDef> = [
  {
    id: 'central-side-gutters',
    name: '1. Side gutters (current)',
    blurb:
      'Today\'s shipping layout. Track strip on top, village centred, science / economy trackers + lost-ideas pile in the right gutter. The 1fr gutters absorb extra page width without stretching the village.',
    Render: CentralSideGutters,
  },
  {
    id: 'central-stacked-column',
    name: '2. Stacked column',
    blurb:
      'One tall column: track → village → telemetry strip. Reads top-to-bottom as "what\'s coming → where you act → how close the boss is". Symmetric on every screen width.',
    Render: CentralStackedColumn,
  },
  {
    id: 'central-boss-anchored',
    name: '3. Boss-anchored',
    blurb:
      'Treats the boss telegraph as the headline. Trackers sit under the track strip in a wide bar, so the table reads "what\'s coming" before "where to act". Village drops to the visual base.',
    Render: CentralBossAnchored,
  },
  {
    id: 'central-two-column',
    name: '4. Ledger',
    blurb:
      'Village on the left, a tall right rail of trackers + a reserved boss readout slot. Frames the village as the play surface and everything else as a control panel beside it.',
    Render: CentralTwoColumn,
  },
  {
    id: 'central-wrap-around',
    name: '5. Wrap-around track',
    blurb:
      'Past phases on the left, current up top, upcoming on the right — the track wraps three sides of the village. The world literally surrounds the settlement; trackers tuck below as one strip.',
    Render: CentralWrapAround,
  },
];
