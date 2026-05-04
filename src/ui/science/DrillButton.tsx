// Defense redesign 3.7 — DrillButton.
//
// Renders a single button + per-round status line for the science seat's
// `scienceDrill` move. Clicking opens a UnitPicker modal listing every
// unit on the village grid; picking a unit dispatches
// `scienceDrill(unitID)` and closes the modal.
//
// State the button reads off the panel:
//   - `canAct`        — seat is in `scienceTurn` and hasn't ended their
//                       turn (drill is gated on the parallel-actives stage
//                       like every other science move).
//   - `drillUsed`     — `G.science.scienceDrillUsed` per-round latch.
//   - `stashScience`  — current science count in the seat's stash.
//   - `drillCost`     — flat `1 science` per the V1 helper in
//                       `roles/science/drill.ts`. Passed in so the
//                       caller can pin the value without this component
//                       depending on the move's source file.
//   - `units`         — `G.defense.inPlay` view (no defense state ⇒
//                       empty list ⇒ disabled button).
//
// Once-per-round greyed state surfaces a tooltip explaining "drilled this
// round." Stash-short and no-units states surface their own messages so
// the player knows *why* the button is disabled.

import { useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { UnitPickerDialog } from './UnitPicker.tsx';
import { drillDisabledReason } from './drillTeachLogic.ts';

export interface DrillButtonProps {
  units: ReadonlyArray<UnitInstance>;
  canAct: boolean;
  drillUsed: boolean;
  stashScience: number;
  drillCost: number;
  onDrill: (unitID: string) => void;
}

export function DrillButton({
  units,
  canAct,
  drillUsed,
  stashScience,
  drillCost,
  onDrill,
}: DrillButtonProps) {
  const [open, setOpen] = useState(false);

  const reason = drillDisabledReason({
    canAct,
    drillUsed,
    stashScience,
    drillCost,
    units,
  });
  const disabled = reason !== null;

  const status = drillUsed ? 'used this round' : 'available';

  const handlePick = (unitID: string): void => {
    onDrill(unitID);
    setOpen(false);
  };

  return (
    <Stack spacing={0.5} data-drill-control="true">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title={reason ?? ''} disableHoverListener={!disabled}>
          <Box component="span" sx={{ display: 'inline-flex' }}>
            <Button
              variant="contained"
              disabled={disabled}
              onClick={() => setOpen(true)}
              aria-label="Drill a unit"
              data-drill-button="true"
              data-drill-disabled={disabled ? 'true' : 'false'}
              sx={{
                bgcolor: (t) => t.palette.role.science.main,
                color: (t) => t.palette.role.science.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.science.dark,
                },
              }}
            >
              Drill ({drillCost} science)
            </Button>
          </Box>
        </Tooltip>
        <Typography
          variant="caption"
          data-drill-status={drillUsed ? 'used' : 'available'}
          sx={{
            color: (t) =>
              drillUsed ? t.palette.status.muted : t.palette.role.science.light,
          }}
        >
          Drill: {status}
        </Typography>
      </Stack>

      <UnitPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Drill a unit"
        header={
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Spend {drillCost} science from your stash to mark a unit. The
            unit's next fire deals +1 strength.
          </Typography>
        }
        units={units}
        onPick={handlePick}
      />
    </Stack>
  );
}

export default DrillButton;
