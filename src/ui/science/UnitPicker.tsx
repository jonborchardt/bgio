// Defense redesign 3.7 — UnitPicker.
//
// Reusable list of placed units the science seat can target with their
// Drill / Teach moves. Renders one row per unit with name, current HP,
// tile location, and whatever per-instance markers are already on the
// instance (drillToken, taughtSkills). Each row is a clickable button
// that calls back the unit's id.
//
// Two render modes:
//   - inline: a vertical list inside whatever container the caller
//             provides (e.g. a small Paper inside the SciencePanel).
//   - dialog: wrapped in a `<Dialog>` so the panel can pop the picker
//             above the rest of the UI.
//
// The component is deliberately presentational: it doesn't dispatch
// moves itself. The caller (DrillButton / TeachDialog) binds the move
// to the picked unit ID. A `disabled(unit)` predicate lets the caller
// grey out unpickable units (e.g. the unit that already has the
// in-flight skill) while keeping them visible — the player benefits
// from "this unit can't take this skill *because*" feedback rather
// than the row vanishing.

import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import type { UnitInstance } from '../../game/roles/defense/types.ts';

export interface UnitPickerProps {
  units: ReadonlyArray<UnitInstance>;
  /** Optional predicate marking a unit as disabled. Returns either
   *  `false` (enabled) or a string explanation surfaced as a per-row
   *  caption. */
  disabled?: (unit: UnitInstance) => false | string;
  /** Click handler for an enabled unit. */
  onPick: (unitID: string) => void;
  /** Empty-state copy when `units` is empty. */
  emptyHint?: string;
  /** Optional extra render block per row, e.g. a per-unit cost preview
   *  for the Teach picker. */
  renderExtra?: (unit: UnitInstance) => ReactNode;
}

export function UnitPicker({
  units,
  disabled,
  onPick,
  emptyHint = 'No units on the village grid yet.',
  renderExtra,
}: UnitPickerProps) {
  if (units.length === 0) {
    return (
      <Typography
        variant="body2"
        data-unit-picker-empty="true"
        sx={{
          color: (t) => t.palette.status.muted,
          fontStyle: 'italic',
          py: 1,
        }}
      >
        {emptyHint}
      </Typography>
    );
  }

  // Sort ascending by placementOrder so the table shows oldest first.
  const sorted = [...units].sort(
    (a, b) => a.placementOrder - b.placementOrder,
  );

  return (
    <Stack
      spacing={0.5}
      data-unit-picker="true"
      aria-label="Choose a unit"
    >
      {sorted.map((unit) => {
        const why = disabled?.(unit);
        const isDisabled = typeof why === 'string';
        return (
          <Button
            key={unit.id}
            variant="outlined"
            size="small"
            disabled={isDisabled}
            onClick={() => onPick(unit.id)}
            data-unit-id={unit.id}
            aria-label={`Pick unit ${unit.defID} on tile ${unit.cellKey}`}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              borderColor: (t) => t.palette.role.science.dark,
              color: (t) => t.palette.role.science.contrastText,
              '&:hover:not(:disabled)': {
                borderColor: (t) => t.palette.role.science.main,
                bgcolor: (t) => t.palette.role.science.dark,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                width: '100%',
                flexWrap: 'wrap',
              }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                {unit.defID}
              </Box>
              <Box
                component="span"
                sx={{
                  color: (t) => t.palette.status.muted,
                  fontSize: '0.75rem',
                }}
              >
                hp {unit.hp} · tile {unit.cellKey} · #{unit.placementOrder}
              </Box>
              {renderExtra?.(unit)}
              {isDisabled ? (
                <Box
                  component="span"
                  data-unit-picker-disabled-reason="true"
                  sx={{
                    color: (t) => t.palette.status.warning,
                    fontSize: '0.7rem',
                    fontStyle: 'italic',
                    width: '100%',
                  }}
                >
                  {why}
                </Box>
              ) : null}
            </Stack>
          </Button>
        );
      })}
    </Stack>
  );
}

export interface UnitPickerDialogProps extends UnitPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional content rendered above the picker (e.g. cost preview,
   *  affordability line, etc.). */
  header?: ReactNode;
  /** Optional footer rendered below the picker (e.g. confirm/cancel
   *  buttons). */
  footer?: ReactNode;
}

/**
 * Modal wrapper around `UnitPicker`. Used by both DrillButton (single-
 * step pick) and TeachDialog (after-skill-chosen pick).
 */
export function UnitPickerDialog({
  open,
  onClose,
  title,
  header,
  footer,
  ...pickerProps
}: UnitPickerDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="unit-picker-title"
    >
      <DialogTitle
        id="unit-picker-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box component="span">{title}</Box>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          ×
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {header}
          <UnitPicker {...pickerProps} />
          {footer}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default UnitPicker;
