/* eslint-disable react-refresh/only-export-components -- workshop file: layout components are co-located with the LAYOUTS registry; preview reloads whole on hash change. */
// Five layout candidates for the Chief panel.
//
// Live ChiefPanel sections:
//   - Header (role label) + actions row (Graveyard · Undo · Tax/Flip/End)
//   - Requests row (peers asking for resources)
//   - "Chief moves" — Tax button (chief super-power, once / round)
//   - Playable hand — gold tech cards
//   - "Send resources" — one CircleEditor per non-chief seat (×3)
//
// Each layout schematic re-arranges those blocks; subcomponent insides
// are out of scope.

import { Box, Stack } from '@mui/material';
import { RoleFrame } from '../RoleFrame.tsx';
import { Slot } from '../Slot.tsx';
import { Chip } from '../Chip.tsx';
import type { LayoutDef } from '../types.ts';

const ChiefActions = (
  <>
    <Chip label="Graveyard" />
    <Chip label="Undo" />
    <Chip label="Flip Track" role="chief" filled />
  </>
);

function CircleSeat({ label }: { label: string }) {
  return (
    <Slot
      label={label}
      note="Push / pull"
      role="chief"
      minHeight={120}
      sx={{ flex: 1, minWidth: 140 }}
    />
  );
}

// --- 1. Linear stack (current) -------------------------------------
function ChiefLinear() {
  return (
    <RoleFrame role="chief" actions={ChiefActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" note="peer asks" minHeight={48} />
        <Slot label="Chief moves" note="Tax button" minHeight={56} />
        <Slot label="Hand" note="gold tech cards" minHeight={120} />
        <Slot
          label="Send resources"
          note="3 seat editors"
          role="chief"
          emphasis="hero"
          minHeight={140}
        >
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <CircleSeat label="Seat 1 · Science" />
            <CircleSeat label="Seat 2 · Domestic" />
            <CircleSeat label="Seat 3 · Defense" />
          </Stack>
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

// --- 2. Distribute-first --------------------------------------------
// Send-resources is the workhorse — promote it to the headline so the
// chief reads "where am I sending this round" before anything else.
function ChiefDistributeFirst() {
  return (
    <RoleFrame role="chief" actions={ChiefActions}>
      <Stack spacing={1}>
        <Slot
          label="Send resources"
          note="3 seat editors · the headline"
          role="chief"
          emphasis="hero"
          minHeight={160}
        >
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <CircleSeat label="Seat 1 · Science" />
            <CircleSeat label="Seat 2 · Domestic" />
            <CircleSeat label="Seat 3 · Defense" />
          </Stack>
        </Slot>
        <Stack direction="row" spacing={1}>
          <Slot label="Chief moves" note="Tax" minHeight={56} sx={{ flex: 1 }} />
          <Slot
            label="Requests row"
            note="peer asks"
            minHeight={56}
            sx={{ flex: 1 }}
          />
        </Stack>
        <Slot label="Hand" note="gold tech cards" minHeight={120} />
      </Stack>
    </RoleFrame>
  );
}

// --- 3. Two columns -------------------------------------------------
// Send-resources fills the left rail, all the smaller surfaces stack on
// the right. Reads as "primary action · supporting tools".
function ChiefTwoColumn() {
  return (
    <RoleFrame role="chief" actions={ChiefActions}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          columnGap: 1,
          alignItems: 'flex-start',
        }}
      >
        <Slot
          label="Send resources"
          note="3 seat editors · stacked vertically"
          role="chief"
          emphasis="hero"
          minHeight={320}
        >
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            <CircleSeat label="Seat 1 · Science" />
            <CircleSeat label="Seat 2 · Domestic" />
            <CircleSeat label="Seat 3 · Defense" />
          </Stack>
        </Slot>
        <Stack spacing={1}>
          <Slot label="Requests row" note="peer asks" minHeight={48} />
          <Slot label="Chief moves" note="Tax" minHeight={56} />
          <Slot label="Hand" note="gold tech cards" minHeight={180} />
        </Stack>
      </Box>
    </RoleFrame>
  );
}

// --- 4. Bench (per-seat columns) ------------------------------------
// Each seat editor gets a full column — the chief reads each peer as
// its own "lane" with hand + moves shown above them as table-shared
// context. Useful when you want the seats to feel like 3 mini-panels.
function ChiefBench() {
  return (
    <RoleFrame role="chief" actions={ChiefActions}>
      <Stack spacing={1}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 1,
          }}
        >
          <Slot label="Hand" note="gold tech" minHeight={96} />
          <Stack spacing={0.75}>
            <Slot label="Requests row" minHeight={40} />
            <Slot label="Chief moves" note="Tax" minHeight={40} />
          </Stack>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            columnGap: 1,
          }}
        >
          <CircleSeat label="Seat 1 · Science" />
          <CircleSeat label="Seat 2 · Domestic" />
          <CircleSeat label="Seat 3 · Defense" />
        </Box>
      </Stack>
    </RoleFrame>
  );
}

// --- 5. Hub-and-spoke ----------------------------------------------
// The chief's bank sits in the middle as a hero badge; the three seat
// editors fan out around it as spokes. Tax/hand/requests collapse into
// a header rail. Reads more like a chess master at the centre of the
// table than a stack of forms.
function ChiefHubAndSpoke() {
  return (
    <RoleFrame role="chief" actions={ChiefActions}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75}>
          <Slot label="Requests" minHeight={40} sx={{ flex: 1 }} />
          <Slot label="Tax" minHeight={40} sx={{ flex: 1 }} />
          <Slot label="Hand" note="gold tech" minHeight={40} sx={{ flex: 2 }} />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr 1fr',
            gridTemplateRows: 'auto auto',
            gap: 1,
            alignItems: 'stretch',
          }}
        >
          <CircleSeat label="Seat 1 · Science" />
          <Slot
            label="Bank"
            note="chief's vault"
            role="chief"
            emphasis="hero"
            minHeight={140}
            sx={{ gridRow: '1 / span 2' }}
          />
          <CircleSeat label="Seat 2 · Domestic" />
          <Box sx={{ gridColumn: '1' }} />
          <Box sx={{ gridColumn: '3' }}>
            <CircleSeat label="Seat 3 · Defense" />
          </Box>
        </Box>
      </Stack>
    </RoleFrame>
  );
}

export const CHIEF_LAYOUTS: ReadonlyArray<LayoutDef> = [
  {
    id: 'chief-linear',
    name: '1. Linear stack (current)',
    blurb:
      'Today\'s shipping arrangement. Requests → Chief moves → Hand → Send resources, top-to-bottom. The seat editors sit at the bottom as the workhorse block.',
    Render: ChiefLinear,
  },
  {
    id: 'chief-distribute-first',
    name: '2. Distribute-first',
    blurb:
      '"Where am I sending this round" is the chief\'s primary question, so promote it to the headline. Requests + Tax become a paired row; Hand drops to the base.',
    Render: ChiefDistributeFirst,
  },
  {
    id: 'chief-two-column',
    name: '3. Two columns',
    blurb:
      'Send-resources fills the left rail with seats stacked vertically; everything else (requests, tax, hand) lines up on the right. Reads as "primary action · supporting tools".',
    Render: ChiefTwoColumn,
  },
  {
    id: 'chief-bench',
    name: '4. Bench (per-seat columns)',
    blurb:
      'Every non-chief seat gets its own column at the base — the chief reads each peer as its own lane. Hand + requests + moves sit above as table-shared context.',
    Render: ChiefBench,
  },
  {
    id: 'chief-hub-and-spoke',
    name: '5. Hub-and-spoke',
    blurb:
      'Bank is the centred hero badge; the three seat editors fan around it as spokes. Tax / hand / requests collapse into a single top rail.',
    Render: ChiefHubAndSpoke,
  },
];
