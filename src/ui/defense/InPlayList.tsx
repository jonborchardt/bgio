// Defense redesign 3.6 — InPlayList.
//
// Sidebar listing of every defense unit currently on the village grid
// (`G.defense.inPlay`). Reads each unit's `cellKey` to surface "where"
// the unit is, prints current / max HP, and renders the per-instance
// drill / taught-skill markers the resolver layers on top of the base
// stats.
//
// The list is presentational — the picker dialogs (TeachDialog) reuse
// the science-side UnitPicker for targeting. This component is the
// "what's actually on the board" status glance.
//
// Sort order: ascending `placementOrder`, so the oldest (first-placed,
// first-killed under D13) leads — same direction the UnitStack
// renders, just laid out vertically and labeled.
//
// Indicator semantics (matches UnitStack's tooltip text in 3.2 so the
// table reads consistent across the grid + the panel):
//   - drillToken === true       → "★ drilled" tag (next fire +1)
//   - taughtSkills includes …   → "[skillID]" chip per skill

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { UNITS } from '../../data/index.ts';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';

export interface InPlayListProps {
  units: ReadonlyArray<UnitInstance>;
  /** Optional empty-state hint. */
  emptyHint?: string;
}

interface UnitRowProps {
  unit: UnitInstance;
}

function UnitRow({ unit }: UnitRowProps) {
  const def = UNITS.find((u) => u.name === unit.defID);
  const drilled = unit.drillToken === true;
  const taughtSkills = unit.taughtSkills ?? [];
  const maxHp = def?.hp ?? unit.hp;

  return (
    <Stack
      direction="row"
      spacing={1}
      data-defense-inplay-row="true"
      data-unit-id={unit.id}
      data-unit-def={unit.defID}
      data-unit-cell={unit.cellKey}
      data-unit-drilled={drilled ? 'true' : 'false'}
      data-unit-taught-count={taughtSkills.length}
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: 0.5,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: (t) => t.palette.card.surface,
        border: '1px solid',
        borderColor: (t) => t.palette.role.defense.dark,
      }}
    >
      <Box
        component="span"
        sx={{
          fontWeight: 700,
          color: (t) => t.palette.role.defense.contrastText,
        }}
      >
        {unit.defID}
      </Box>
      <Box
        component="span"
        sx={{
          color: (t) => t.palette.status.muted,
          fontSize: '0.75rem',
        }}
      >
        {unit.cellKey} · hp {unit.hp}/{maxHp} · #{unit.placementOrder}
      </Box>
      {drilled ? (
        <Tooltip title="Drilled — next fire deals +1 strength.">
          <Box
            component="span"
            data-defense-inplay-drill="true"
            aria-label="Drilled"
            sx={{
              color: (t) => t.palette.status.warning,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            ★ drilled
          </Box>
        </Tooltip>
      ) : null}
      {taughtSkills.length > 0 ? (
        <Stack
          direction="row"
          spacing={0.5}
          data-defense-inplay-skills="true"
          sx={{ flexWrap: 'wrap', rowGap: 0.25, alignItems: 'center' }}
        >
          {taughtSkills.map((skillID) => (
            <Box
              key={skillID}
              component="span"
              data-defense-inplay-skill={skillID}
              sx={{
                px: 0.6,
                py: 0.1,
                borderRadius: 0.75,
                bgcolor: (t) => t.palette.role.science.dark,
                color: (t) => t.palette.role.science.contrastText,
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {skillID}
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function InPlayList({
  units,
  emptyHint = 'No units on the village grid yet — buy and place a unit to get started.',
}: InPlayListProps) {
  if (units.length === 0) {
    return (
      <EmbossedFrame
        role="defense"
        sx={{
          alignSelf: 'stretch',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          data-defense-inplay-empty="true"
          sx={{
            color: (t) => t.palette.status.muted,
            fontStyle: 'italic',
            py: 2,
          }}
        >
          {emptyHint}
        </Typography>
      </EmbossedFrame>
    );
  }

  // Sort ascending by placementOrder — oldest leads (D13 alignment).
  const sorted = [...units].sort(
    (a, b) => a.placementOrder - b.placementOrder,
  );

  return (
    <Stack
      spacing={0.5}
      data-defense-inplay-list="true"
      data-defense-inplay-count={sorted.length}
      aria-label={`Units in play (${sorted.length})`}
    >
      {sorted.map((u) => (
        <UnitRow key={u.id} unit={u} />
      ))}
    </Stack>
  );
}

export default InPlayList;
