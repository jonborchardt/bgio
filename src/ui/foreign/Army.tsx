// Foreign Army — count-collapsed list of in-play units. Clicking a row
// releases one of that unit type via `onRelease(defID)`.
//
// Visuals route through the canonical `UnitCard` component at `small`
// size so the look in-game matches the relationships modal exactly.
// The `?` button (CardInfoButton inside the card frame) opens the
// per-card info modal.

import { Box, Button, Stack, Typography } from '@mui/material';
import type { UnitInstance } from '../../game/roles/foreign/types.ts';
import { UNITS } from '../../data/index.ts';
import { UnitCard } from '../cards/UnitCard.tsx';

export interface ArmyProps {
  inPlay: UnitInstance[];
  canAct: boolean;
  onRelease: (defID: string) => void;
}

const unitDefByName = new Map(UNITS.map((u) => [u.name, u]));

export function Army({ inPlay, canAct, onRelease }: ArmyProps) {
  return (
    <Stack spacing={0.5} aria-label="Foreign army">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography
          variant="body2"
          sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
        >
          Army
        </Typography>
      </Stack>
      {inPlay.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          No units recruited.
        </Typography>
      ) : (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'flex-start' }}
        >
          {inPlay.flatMap((unit) => {
            const def = unitDefByName.get(unit.defID);
            // Render one card per recruited copy so a Brute x3 reads as
            // three actual Brute cards on the table, not a single tile
            // with a count badge. Each per-copy card shares the same
            // Release button (release-one semantics are unchanged).
            return Array.from({ length: unit.count }, (_, i) => (
              <Stack
                key={`${unit.defID}-${i}`}
                spacing={0.5}
                sx={{ alignItems: 'stretch' }}
              >
                {def ? (
                  <UnitCard def={def} size="normal" />
                ) : (
                  <Box>
                    <Typography
                      sx={{ color: (t) => t.palette.role.foreign.main, fontWeight: 600 }}
                    >
                      {unit.defID}
                    </Typography>
                  </Box>
                )}
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
            ));
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default Army;
