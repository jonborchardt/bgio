/* eslint-disable react-refresh/only-export-components -- workshop file: layout components are co-located with the LAYOUTS registry; preview reloads whole on hash change. */
// Five layout candidates for the Science panel.
//
// Live SciencePanel sections:
//   - Header (role label) + actions row (Graveyard · Undo · End my turn)
//   - Requests row
//   - Library — 6-slot face-up row (Buy / Burn) — biggest surface
//   - Science moves — Drill + Teach buttons
//   - Hand — blue tech cards
//   - My discounts — per-seat tableau

import { Box, Stack } from '@mui/material';
import { RoleFrame } from '../RoleFrame.tsx';
import { Slot } from '../Slot.tsx';
import { Chip } from '../Chip.tsx';
import type { LayoutDef } from '../types.ts';

const ScienceActions = (
  <>
    <Chip label="Graveyard" />
    <Chip label="Undo" />
    <Chip label="End my turn" role="science" filled />
  </>
);

function LibrarySlots() {
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <Slot
          key={i}
          label={`#${i + 1}`}
          minHeight={88}
          sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        />
      ))}
    </Stack>
  );
}

// --- 1. Linear stack (current) -------------------------------------
function ScienceLinear() {
  return (
    <RoleFrame role="science" actions={ScienceActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Slot
          label="Library"
          note="6 slots · Buy / Burn"
          role="science"
          emphasis="hero"
          minHeight={120}
        >
          <LibrarySlots />
        </Slot>
        <Slot label="Science moves" note="Drill · Teach" minHeight={56} />
        <Slot label="Hand" note="blue tech cards" minHeight={120} />
        <Slot label="My discounts" note="tableau" minHeight={72} />
      </Stack>
    </RoleFrame>
  );
}

// --- 2. Library-hero with sidebar ----------------------------------
// The library is the science seat's main surface — let it span full
// width and pin the discount tableau to a sticky right rail so the
// player always sees their snowball while they shop.
function ScienceLibraryHero() {
  return (
    <RoleFrame role="science" actions={ScienceActions}>
      <Stack spacing={1}>
        <Slot
          label="Library"
          note="6 slots · Buy / Burn (full bleed)"
          role="science"
          emphasis="hero"
          minHeight={140}
        >
          <LibrarySlots />
        </Slot>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 220px',
            columnGap: 1,
          }}
        >
          <Stack spacing={1}>
            <Slot label="Requests row" minHeight={40} />
            <Slot label="Science moves" note="Drill · Teach" minHeight={56} />
            <Slot label="Hand" note="blue tech cards" minHeight={120} />
          </Stack>
          <Slot
            label="My discounts"
            note="sticky tableau"
            role="science"
            minHeight={228}
          />
        </Box>
      </Stack>
    </RoleFrame>
  );
}

// --- 3. Workbench (left column = decisions, right column = state) --
// Two clean columns: left is "what I do this turn" (library + moves +
// hand), right is "what I have" (discounts + requests). Mirrors the
// Splendor mental model.
function ScienceWorkbench() {
  return (
    <RoleFrame role="science" actions={ScienceActions}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          columnGap: 1,
          alignItems: 'flex-start',
        }}
      >
        <Stack spacing={1}>
          <Slot
            label="Library"
            note="6 slots"
            role="science"
            emphasis="hero"
            minHeight={120}
          >
            <LibrarySlots />
          </Slot>
          <Slot label="Science moves" note="Drill · Teach" minHeight={56} />
          <Slot label="Hand" note="blue tech cards" minHeight={100} />
        </Stack>
        <Stack spacing={1}>
          <Slot label="Requests row" minHeight={48} />
          <Slot
            label="My discounts"
            note="snowball tableau · big"
            role="science"
            emphasis="hero"
            minHeight={200}
          />
        </Stack>
      </Box>
    </RoleFrame>
  );
}

// --- 4. Library + drawer -------------------------------------------
// Library at the top in a wide strip; everything else collapses into
// a single bottom drawer arranged as a 2x2 grid (moves / hand /
// discounts / requests). Trades vertical reach for a board-table feel.
function ScienceDrawer() {
  return (
    <RoleFrame role="science" actions={ScienceActions}>
      <Stack spacing={1}>
        <Slot
          label="Library"
          note="6 slots · table-shared"
          role="science"
          emphasis="hero"
          minHeight={140}
        >
          <LibrarySlots />
        </Slot>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'auto auto',
            gap: 1,
          }}
        >
          <Slot label="Requests row" minHeight={56} />
          <Slot label="Science moves" note="Drill · Teach" minHeight={56} />
          <Slot label="Hand" note="blue tech cards" minHeight={120} />
          <Slot label="My discounts" role="science" minHeight={120} />
        </Box>
      </Stack>
    </RoleFrame>
  );
}

// --- 5. Two-row library (3 over 3) ---------------------------------
// Reframe the library row as a 3×2 board and let the right side be
// the seat's pocket: hand on top, discount tableau below, all
// chrome compressed into a thin top header rail.
function ScienceTwoRowLibrary() {
  return (
    <RoleFrame role="science" actions={ScienceActions}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75}>
          <Slot label="Requests" minHeight={40} sx={{ flex: 1 }} />
          <Slot
            label="Science moves"
            note="Drill · Teach"
            minHeight={40}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            columnGap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Slot
            label="Library"
            note="3 over 3"
            role="science"
            emphasis="hero"
            minHeight={220}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: 0.5,
                mt: 0.5,
              }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <Slot
                  key={i}
                  label={`#${i + 1}`}
                  minHeight={80}
                  sx={{ alignItems: 'center', justifyContent: 'center' }}
                />
              ))}
            </Box>
          </Slot>
          <Stack spacing={1}>
            <Slot label="Hand" note="blue tech cards" minHeight={100} />
            <Slot
              label="My discounts"
              note="tableau"
              role="science"
              minHeight={108}
            />
          </Stack>
        </Box>
      </Stack>
    </RoleFrame>
  );
}

export const SCIENCE_LAYOUTS: ReadonlyArray<LayoutDef> = [
  {
    id: 'science-linear',
    name: '1. Linear stack (current)',
    blurb:
      'Today\'s shipping arrangement. Requests → Library → Moves → Hand → Discounts. Every section is full-width, ordered by frequency of use.',
    Render: ScienceLinear,
  },
  {
    id: 'science-library-hero',
    name: '2. Library-hero + sidebar',
    blurb:
      'The 6-slot library is the science seat\'s main surface — let it span full width up top and pin the discount tableau to a sticky right rail so the player always sees their snowball.',
    Render: ScienceLibraryHero,
  },
  {
    id: 'science-workbench',
    name: '3. Workbench (decisions / state)',
    blurb:
      'Two columns, mirroring the Splendor mental model. Left = "what I do this turn" (library + moves + hand). Right = "what I have" (requests + discount tableau).',
    Render: ScienceWorkbench,
  },
  {
    id: 'science-drawer',
    name: '4. Library + drawer',
    blurb:
      'Library on top as a wide strip; everything else collapses into a 2×2 drawer below (requests / moves / hand / discounts). Trades vertical reach for a board-table feel.',
    Render: ScienceDrawer,
  },
  {
    id: 'science-two-row-library',
    name: '5. 3×2 library',
    blurb:
      'Reframe the library as a 3×2 board (instead of a 6-wide row); right column becomes the seat\'s pocket — hand on top, discount tableau below.',
    Render: ScienceTwoRowLibrary,
  },
];
