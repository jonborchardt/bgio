/* eslint-disable react-refresh/only-export-components -- workshop file: layout components are co-located with the LAYOUTS registry; preview reloads whole on hash change. */
// Five layout candidates for the Defense panel.
//
// Live DefensePanel sections (post-3.9 — village + in-play units live
// at board level):
//   - Header (role label) + actions row (Graveyard · Undo · End my turn)
//   - Requests row
//   - Hand — units (selectable, arms tile placement)
//   - Placement prompt
//   - Tech — red tech cards row

import { Box, Stack } from '@mui/material';
import { RoleFrame } from '../RoleFrame.tsx';
import { Slot } from '../Slot.tsx';
import { Chip } from '../Chip.tsx';
import type { LayoutDef } from '../types.ts';

const DefenseActions = (
  <>
    <Chip label="Graveyard" />
    <Chip label="Undo" />
    <Chip label="End my turn" role="defense" filled />
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
function DefenseLinear() {
  return (
    <RoleFrame role="defense" actions={DefenseActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Slot
          label="Unit hand"
          note="click to arm tile placement"
          role="defense"
          emphasis="hero"
          minHeight={140}
        >
          <CardRow count={4} label="Unit" />
        </Slot>
        <Slot
          label="Placement prompt"
          note="armed-only caption"
          minHeight={32}
          emphasis="muted"
        />
        <Slot label="Tech" note="red tech row" minHeight={120}>
          <CardRow count={3} label="Tech" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

// --- 2. Battlefield strip -------------------------------------------
// Surface a board-shared "in-play units" strip at the top of the panel
// — the seat sees its army before it shops for more. Hand and tech
// drop below as the buy surface.
function DefenseBattlefield() {
  return (
    <RoleFrame role="defense" actions={DefenseActions}>
      <Stack spacing={1}>
        <Slot
          label="In-play units"
          note="echo of UnitStacks across all village tiles"
          role="defense"
          emphasis="hero"
          minHeight={88}
        >
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Slot
                key={i}
                label={`U${i + 1}`}
                minHeight={48}
                sx={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            ))}
          </Stack>
        </Slot>
        <Slot label="Requests row" minHeight={40} />
        <Slot label="Unit hand" note="recruit & place" minHeight={140}>
          <CardRow count={4} label="Unit" />
        </Slot>
        <Slot label="Tech" note="red tech row" minHeight={120}>
          <CardRow count={3} label="Tech" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

// --- 3. Two columns (units / tech) ---------------------------------
// Defense has two distinct buys — units and red tech — and they hit
// different surfaces. Give each its own column so the seat reads "what
// I can place" and "what I can play" side by side.
function DefenseTwoColumn() {
  return (
    <RoleFrame role="defense" actions={DefenseActions}>
      <Stack spacing={1}>
        <Slot label="Requests row" minHeight={40} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Slot
            label="Unit hand"
            note="recruit & place"
            role="defense"
            emphasis="hero"
            minHeight={200}
          >
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Slot
                  key={i}
                  label={`Unit ${i + 1}`}
                  minHeight={48}
                  sx={{ alignItems: 'flex-start', justifyContent: 'center' }}
                />
              ))}
            </Stack>
          </Slot>
          <Slot
            label="Tech"
            note="red tech · 1-shots"
            role="defense"
            minHeight={200}
          >
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Slot
                  key={i}
                  label={`Tech ${i + 1}`}
                  minHeight={48}
                  sx={{ alignItems: 'flex-start', justifyContent: 'center' }}
                />
              ))}
            </Stack>
          </Slot>
        </Box>
        <Slot
          label="Placement prompt"
          note="armed-only banner"
          minHeight={32}
          emphasis="muted"
        />
      </Stack>
    </RoleFrame>
  );
}

// --- 4. Threat-readout header --------------------------------------
// Add a top-of-panel readout that summarises the boss + the path the
// flipped track card carved into the village this round. Helps the
// defense seat decide *where* to recruit before flipping through the
// hand.
function DefenseThreatReadout() {
  return (
    <RoleFrame role="defense" actions={DefenseActions}>
      <Stack spacing={1}>
        <Slot
          label="Threat readout"
          note="this round's path · current boss telegraph"
          role="defense"
          emphasis="hero"
          minHeight={56}
        >
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            <Chip label="Path: NW → C" />
            <Chip label="Boss thr. 7/12" role="defense" />
            <Chip label="Wave size 3" />
          </Stack>
        </Slot>
        <Slot label="Requests row" minHeight={40} />
        <Slot label="Unit hand" minHeight={140}>
          <CardRow count={4} label="Unit" />
        </Slot>
        <Slot label="Tech" note="red tech" minHeight={108}>
          <CardRow count={3} label="Tech" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

// --- 5. Triage (status / units / tech) ------------------------------
// Three rows of equal height: status (requests + threat), units,
// tech. Equal weight reads as "you have three things to consider this
// round, in order."
function DefenseTriage() {
  return (
    <RoleFrame role="defense" actions={DefenseActions}>
      <Stack spacing={1}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 1,
          }}
        >
          <Slot label="Requests row" minHeight={64} />
          <Slot
            label="Threat readout"
            note="path · boss"
            role="defense"
            minHeight={64}
          />
        </Box>
        <Slot
          label="Units"
          note="recruit & place"
          role="defense"
          emphasis="hero"
          minHeight={120}
        >
          <CardRow count={4} label="Unit" />
        </Slot>
        <Slot label="Tech" note="red tech · play to flex" minHeight={120}>
          <CardRow count={4} label="Tech" />
        </Slot>
      </Stack>
    </RoleFrame>
  );
}

export const DEFENSE_LAYOUTS: ReadonlyArray<LayoutDef> = [
  {
    id: 'defense-linear',
    name: '1. Linear stack (current)',
    blurb:
      'Today\'s shipping arrangement. Requests → Unit hand → Placement prompt → Tech. Compact and predictable; surfaces the placement prompt only when something is armed.',
    Render: DefenseLinear,
  },
  {
    id: 'defense-battlefield',
    name: '2. Battlefield strip',
    blurb:
      'Echo the in-play units across all village tiles in a strip at the top — the defense seat sees their army before they shop. Hand + tech drop below as the buy surface.',
    Render: DefenseBattlefield,
  },
  {
    id: 'defense-two-column',
    name: '3. Two columns (units / tech)',
    blurb:
      'Defense has two distinct buys (units and red tech) hitting different surfaces. Give each its own column so the seat reads "what I can place" and "what I can play" side by side.',
    Render: DefenseTwoColumn,
  },
  {
    id: 'defense-threat-readout',
    name: '4. Threat-readout header',
    blurb:
      'Add a top-of-panel readout summarising the boss + the path this round\'s track card carved into the village. Helps the defense seat decide *where* before *what*.',
    Render: DefenseThreatReadout,
  },
  {
    id: 'defense-triage',
    name: '5. Triage rows',
    blurb:
      'Three equal-weight rows: status (requests + threat) · units · tech. Reads as "three things to consider this round, in order." No row dominates the others.',
    Render: DefenseTriage,
  },
];
