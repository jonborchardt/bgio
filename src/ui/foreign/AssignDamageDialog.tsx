// AssignDamageDialog (07.7) — STUB.
//
// V1 stub for the per-round damage absorber chooser. Full implementation
// (per-round absorber UI, validation against the resolver's INVALID_MOVE
// catalog, multi-round flow) is deferred. The stub provides one button:
//   "auto-allocate" — dumps a single allocation `[{ byUnit: { [first
//   defID]: 1 } }]` so the parent can wire `foreignAssignDamage` and
//   exercise the move's resolution path.
//
// When `inPlay` is empty the auto-allocate button submits an empty array,
// which collapses to the "all damage falls through" path inside the
// resolver. (V1 only; the real dialog will refuse submission in that case.)

import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { DamageAllocation } from '../../game/roles/foreign/battleResolver.ts';
import type { UnitInstance } from '../../game/roles/foreign/types.ts';

export interface AssignDamageDialogProps {
  open: boolean;
  inPlay: UnitInstance[];
  onSubmit: (allocations: DamageAllocation[]) => void;
  onCancel: () => void;
}

export function AssignDamageDialog({
  open,
  inPlay,
  onSubmit,
  onCancel,
}: AssignDamageDialogProps) {
  if (!open) return null;

  const handleAuto = (): void => {
    if (inPlay.length === 0) {
      onSubmit([]);
      return;
    }
    const first = inPlay[0]!;
    const allocations: DamageAllocation[] = [
      { byUnit: { [first.defID]: 1 } },
    ];
    onSubmit(allocations);
  };

  return (
    <Box
      role="dialog"
      aria-label="Assign damage"
      sx={{
        // Inline rather than a true overlay — V1 stub.
        mt: 1,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          border: '1px solid',
          borderColor: (t) => t.palette.role.foreign.main,
          bgcolor: (t) => t.palette.card.surface,
        }}
      >
        <Stack spacing={0.75}>
          <Typography
            variant="body2"
            sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 600 }}
          >
            Assign damage (stub)
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: (t) => t.palette.status.muted }}
          >
            Real per-round absorber UI deferred. Auto-allocate dumps 1 damage on
            the first unit in play.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={handleAuto}
              aria-label="Auto-allocate damage"
              sx={{
                bgcolor: (t) => t.palette.role.foreign.main,
                color: (t) => t.palette.role.foreign.contrastText,
                '&:hover': {
                  bgcolor: (t) => t.palette.role.foreign.dark,
                },
              }}
            >
              Auto-allocate
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onCancel}
              aria-label="Cancel damage assignment"
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default AssignDamageDialog;
