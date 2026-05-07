/* eslint-disable react-refresh/only-export-components -- workshop file: layout components are co-located with the LAYOUTS registry; preview reloads whole on hash change. */
// Five layout candidates for the Domestic panel.
//
// Live DomesticPanel sections (post-3.9 — the village grid lives at
// board level, not inside the panel):
//   - Header (role label) + actions row (Graveyard · Undo · End my turn)
//   - Requests row
//   - Hand — buildings (selectable, arms placement) + green tech cards
//   - Placement-prompt caption (only while a building is armed)
//
// Subtler than the other roles: only one big surface here (the hand),
// so most variations explore how to expose two distinct hand kinds
// (buildings vs. green techs) and surface the placement-prompt state.

import { Box, Stack } from '@mui/material';
import { RoleFrame } from '../RoleFrame.tsx';
import { Slot } from '../Slot.tsx';
import { Chip } from '../Chip.tsx';
import type { LayoutDef } from '../types.ts';

const DomesticActions = (
  <>
    <Chip label="Graveyard" />
    <Chip label="Undo" />
    <Chip label="End my turn" role="domestic" filled />
  </>
);

function CardRow({ count, label }: { count: number; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
      {Array.from({ length: count }, (_, i) => (
        <Slot
          key={i}
          label={`${label} ${i + 1}`}
          minHeight={120}
          sx={{ flex: 1, minWidth: 0 }}
        />
      ))}
    </Stack>
  );
}

// --- 1. Linear stack (current) -------------------------------------
function DomesticLinear() {
  return (
    <RoleFrame role="domestic" actions={DomesticActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Slot
          label="Hand"
          note="buildings + green techs interleaved"
          role="domestic"
          emphasis="hero"
          minHeight={160}
        >
          <CardRow count={5} label="Bldg" />
        </Slot>
        <Slot
          label="Placement prompt"
          note="visible while a building is armed"
          minHeight={32}
          emphasis="muted"
        />
      </Stack>
    </RoleFrame>
  );
}

// --- 2. Two stacked hands ------------------------------------------
// Split buildings from green tech cards into two clearly-labelled
// rows, with the placement prompt nestled between them so it reads as
// the next step after picking a building.
function DomesticTwoHands() {
  return (
    <RoleFrame role="domestic" actions={DomesticActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Slot
          label="Buildings"
          note="click to arm placement"
          role="domestic"
          emphasis="hero"
          minHeight={140}
        >
          <CardRow count={4} label="Bldg" />
        </Slot>
        <Slot
          label="Placement prompt"
          note="armed → click a tile on the village above"
          minHeight={36}
          emphasis="muted"
        />
        <Slot
          label="Green techs"
          note="play to unlock more buildings"
          minHeight={120}
        >
          <CardRow count={3} label="Tech" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

// --- 3. Hand + village mini-map ------------------------------------
// Even though the real grid lives at board level, mirror it here as a
// shrunken "armed-tile" preview while a building is selected — gives
// the seat their own at-a-glance feedback without leaving the panel.
function DomesticWithMiniMap() {
  return (
    <RoleFrame role="domestic" actions={DomesticActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 180px',
            columnGap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Stack spacing={1}>
            <Slot
              label="Buildings"
              role="domestic"
              emphasis="hero"
              minHeight={140}
            >
              <CardRow count={4} label="Bldg" />
            </Slot>
            <Slot label="Green techs" minHeight={108}>
              <CardRow count={3} label="Tech" />
            </Slot>
          </Stack>
          <Slot
            label="Mini-map"
            note="echo of village · highlights legal tiles"
            role="domestic"
            minHeight={256}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                gap: 0.5,
                mt: 0.5,
                aspectRatio: '1 / 1',
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <Slot
                  key={i}
                  label=""
                  minHeight={40}
                  sx={{ alignItems: 'center', justifyContent: 'center' }}
                />
              ))}
            </Box>
          </Slot>
        </Box>
      </Stack>
    </RoleFrame>
  );
}

// --- 4. Tabbed hand -------------------------------------------------
// Single hand container with a tab row at top (Buildings / Techs) so
// the panel stays compact. Placement prompt is a banner that drops in
// only when the buildings tab is active and a card is armed.
function DomesticTabbed() {
  return (
    <RoleFrame role="domestic" actions={DomesticActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Stack direction="row" spacing={0.5}>
          <Chip label="Buildings (4)" role="domestic" filled />
          <Chip label="Green techs (3)" />
        </Stack>
        <Slot
          label="Active tab body"
          note="buildings shown; tech is one click away"
          role="domestic"
          emphasis="hero"
          minHeight={170}
        >
          <CardRow count={4} label="Bldg" />
        </Slot>
        <Slot
          label="Placement prompt"
          note="armed-only banner"
          minHeight={36}
          emphasis="muted"
        />
      </Stack>
    </RoleFrame>
  );
}

// --- 5. Playmat (hand at bottom) -----------------------------------
// Inverts the stack: requests + status sit at the top as light chrome,
// the hand fills the bottom edge of the panel like a real card hand
// at a table. Placement prompt floats just above the hand.
function DomesticPlaymat() {
  return (
    <RoleFrame role="domestic" actions={DomesticActions}>
      <Stack spacing={1} sx={{ minHeight: 320 }}>
        <Stack direction="row" spacing={0.75}>
          <Slot label="Requests row" minHeight={40} sx={{ flex: 1 }} />
          <Slot
            label="Stash readout"
            note="resources at risk"
            role="domestic"
            minHeight={40}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Slot
          label="Placement prompt"
          note="armed-only floating tip"
          minHeight={32}
          emphasis="muted"
        />
        <Slot
          label="Hand"
          note="buildings · green techs · fanned at the bottom"
          role="domestic"
          emphasis="hero"
          minHeight={150}
        >
          <CardRow count={6} label="Card" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

export const DOMESTIC_LAYOUTS: ReadonlyArray<LayoutDef> = [
  {
    id: 'domestic-linear',
    name: '1. Linear stack (current)',
    blurb:
      'Today\'s shipping arrangement. Requests → Hand (buildings + techs interleaved) → Placement prompt. Compact and uncluttered, but the two hand kinds blur together.',
    Render: DomesticLinear,
  },
  {
    id: 'domestic-two-hands',
    name: '2. Two stacked hands',
    blurb:
      'Split buildings from green tech cards into two clearly-labelled rows; the placement prompt nestles between them so it reads as the next step after arming a building.',
    Render: DomesticTwoHands,
  },
  {
    id: 'domestic-mini-map',
    name: '3. Hand + mini-map',
    blurb:
      'Even though the live village lives at board level, mirror it here as a shrunken preview — gives the domestic seat at-a-glance "where can I place" feedback without leaving the panel.',
    Render: DomesticWithMiniMap,
  },
  {
    id: 'domestic-tabbed',
    name: '4. Tabbed hand',
    blurb:
      'Single hand container with a tab row (Buildings / Techs). Stays compact for a low-decision turn; the placement prompt is a banner that drops in only when needed.',
    Render: DomesticTabbed,
  },
  {
    id: 'domestic-playmat',
    name: '5. Playmat (hand at bottom)',
    blurb:
      'Inverts the stack: chrome (requests + stash) at top, hand fills the bottom edge of the panel like a real card hand at a table. Placement prompt floats above.',
    Render: DomesticPlaymat,
  },
];
