// CircleEditor — per-target widget rendered by ChiefPanel for each non-chief
// seat. Each row shows a -2 / -1 / Current / +1 / +2 stepper for one
// resource: positive presses push from bank into the seat's `in` slot,
// negative presses pull back. The middle "Current" pill shows what is
// currently sitting in the seat's `in` for that resource. Buttons that
// would underflow the bank or the in-slot are disabled.
//
// Rows render per-non-zero-bank-resource, plus gold is always shown (the
// canonical chief output). When everything is zero we keep the rows
// rendered so the chief still sees the seat's current `in` values; no
// extra placeholder text is emitted.
//
// All visual choices route through the theme tokens added in 09.4
// (palette.resource.<r>.main / .contrastText) — no raw hex literals.

import { Box, Button, ButtonGroup, Stack, Typography } from '@mui/material';
import type { PlayerID, Role } from '../../game/types.ts';
import {
  RESOURCES,
  type Resource,
  type ResourceBag,
} from '../../game/resources/types.ts';

// Mirrors SeatPicker / Circle ROLE_ACCENT_PRIORITY so the editor's
// title and accent match the mat tile for the same seat.
const ROLE_ACCENT_PRIORITY: ReadonlyArray<Role> = [
  'chief',
  'science',
  'domestic',
  'foreign',
];

const accentRoleFor = (roles: ReadonlyArray<Role>): Role | undefined =>
  ROLE_ACCENT_PRIORITY.find((r) => roles.includes(r));

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

const STEP_AMOUNTS: readonly number[] = [-2, -1, 1, 2] as const;

export interface CircleEditorProps {
  seat: PlayerID;
  roles: ReadonlyArray<Role>;
  /** Tokens already in this seat's `in` slot this round. */
  inBag: ResourceBag;
  bank: ResourceBag;
  canPush: boolean;
  onPush: (resource: Resource, amount: number) => void;
}

export function CircleEditor({
  seat,
  roles,
  inBag,
  bank,
  canPush,
  onPush,
}: CircleEditorProps) {
  const accent = accentRoleFor(roles);
  const label = roles.length > 0 ? roles.map(titleCase).join(' · ') : '—';
  // Render every resource the bank holds. Gold is forced visible (it's
  // the canonical chief output) so the row layout doesn't flicker when
  // other resources transiently drain to zero between rounds.
  const resourcesShown: Resource[] = RESOURCES.filter(
    (r) => r === 'gold' || (bank[r] ?? 0) > 0,
  );

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: (t) =>
          accent ? t.palette.role[accent].main : t.palette.status.muted,
        bgcolor: (t) => t.palette.card.surface,
      }}
      aria-label={`${label} mat editor (Player ${Number(seat) + 1})`}
    >
      <Typography
        sx={{
          color: (t) =>
            accent ? t.palette.role[accent].main : t.palette.card.text,
          fontWeight: 700,
          letterSpacing: '0.02em',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>

      <Stack spacing={1}>
        {resourcesShown.map((resource) => {
          const placed = inBag[resource] ?? 0;
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
              <ButtonGroup size="small" variant="outlined">
                {STEP_AMOUNTS.slice(0, 2).map((amount) => {
                  const disabled = !canPush || placed < -amount;
                  return (
                    <Button
                      key={amount}
                      disabled={disabled}
                      onClick={() => onPush(resource, amount)}
                      aria-label={`Pull ${amount} ${resource} from ${label}`}
                    >
                      {amount}
                    </Button>
                  );
                })}
                <Button
                  disabled
                  aria-label={`Current ${resource} placed: ${placed}`}
                  sx={{
                    minWidth: '2.5rem',
                    fontWeight: 700,
                    '&.Mui-disabled': {
                      color: (t) => t.palette.resource[resource].main,
                    },
                  }}
                >
                  {placed}
                </Button>
                {STEP_AMOUNTS.slice(2).map((amount) => {
                  const disabled = !canPush || inBank < amount;
                  return (
                    <Button
                      key={amount}
                      disabled={disabled}
                      onClick={() => onPush(resource, amount)}
                      aria-label={`Push +${amount} ${resource} to ${label}`}
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
