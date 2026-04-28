// Foreign Army (07.7) — count-collapsed list of in-play units. Clicking a
// row releases one of that unit type via `onRelease(defID)`. The full
// release-dialog UX (pick how many, confirm) is deferred — V1 always
// releases one per click, mirroring the recruit / release moves' default.

import { Button, Stack, Typography } from '@mui/material';
import type { UnitInstance } from '../../game/roles/foreign/types.ts';

export interface ArmyProps {
  inPlay: UnitInstance[];
  canAct: boolean;
  onRelease: (defID: string) => void;
}

export function Army({ inPlay, canAct, onRelease }: ArmyProps) {
  return (
    <Stack spacing={0.5} aria-label="Foreign army">
      <Typography
        variant="body2"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
      >
        Army
      </Typography>
      {inPlay.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          No units recruited.
        </Typography>
      ) : (
        inPlay.map((unit) => (
          <Stack
            key={unit.defID}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <Typography
              sx={{
                color: (t) => t.palette.role.foreign.main,
                fontWeight: 600,
                minWidth: '8rem',
              }}
            >
              {unit.defID} ×{unit.count}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={!canAct}
              onClick={() => onRelease(unit.defID)}
              aria-label={`Release one ${unit.defID}`}
            >
              Release
            </Button>
          </Stack>
        ))
      )}
    </Stack>
  );
}

export default Army;
