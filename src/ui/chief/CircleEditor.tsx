// CircleEditor — per-target widget rendered by ChiefPanel for each non-chief
// seat. Shows the resource currently in that seat's center-mat circle and
// exposes +1 / +2 / +5 push buttons that route through the parent's
// onPush(resource, amount) callback (which in turn calls the chiefDistribute
// move). For V1 the only resource shown is gold; once UNITS / other resources
// flow through chiefDistribute later slices, extend the resource list here.
//
// All visual choices route through the theme tokens added in 09.4
// (palette.resource.<r>.main / .contrastText) — no raw hex literals.

import { Box, Button, ButtonGroup, Stack, Typography } from '@mui/material';
import type { PlayerID } from '../../game/types.ts';
import type {
  Resource,
  ResourceBag,
} from '../../game/resources/types.ts';

// Gold-only for V1 — see header. Listed as an array so future resources slot
// in by appending without restructuring the JSX.
const RESOURCES_SHOWN: readonly Resource[] = ['gold'] as const;

const PUSH_AMOUNTS: readonly number[] = [1, 2, 5] as const;

export interface CircleEditorProps {
  seat: PlayerID;
  circle: ResourceBag;
  bank: ResourceBag;
  canPush: boolean;
  onPush: (resource: Resource, amount: number) => void;
}

export function CircleEditor({
  seat,
  circle,
  bank,
  canPush,
  onPush,
}: CircleEditorProps) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) => t.palette.status.muted,
        bgcolor: (t) => t.palette.card.surface,
      }}
      aria-label={`Circle editor for seat ${seat}`}
    >
      <Typography
        variant="body2"
        sx={{ color: (t) => t.palette.status.muted, mb: 0.5 }}
      >
        Player {Number(seat) + 1}
      </Typography>

      <Stack spacing={1}>
        {RESOURCES_SHOWN.map((resource) => {
          const inCircle = circle[resource] ?? 0;
          const inBank = bank[resource] ?? 0;
          return (
            <Stack
              key={resource}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center' }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minWidth: '6rem',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    bgcolor: (t) => t.palette.resource[resource].main,
                    mr: 1,
                  }}
                />
                <Typography
                  sx={{
                    color: (t) => t.palette.resource[resource].main,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {resource}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ color: (t) => t.palette.status.muted, minWidth: '4rem' }}
              >
                in circle: {inCircle}
              </Typography>
              <ButtonGroup size="small" variant="outlined">
                {PUSH_AMOUNTS.map((amount) => {
                  const disabled = !canPush || inBank < amount;
                  return (
                    <Button
                      key={amount}
                      disabled={disabled}
                      onClick={() => onPush(resource, amount)}
                      aria-label={`Push +${amount} ${resource} to player ${
                        Number(seat) + 1
                      }`}
                    >
                      +{amount}
                    </Button>
                  );
                })}
              </ButtonGroup>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

export default CircleEditor;
