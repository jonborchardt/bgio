// CircleEditor — per-target widget rendered by ChiefPanel for each non-chief
// seat. Shows the resources currently in that seat's center-mat circle and
// exposes +1 / +2 / +5 push buttons that route through the parent's
// onPush(resource, amount) callback (which in turn calls the chiefDistribute
// move).
//
// 14.4: rows are now per-non-zero-bank-resource rather than gold-only. The
// chief sees one row per resource the bank actually holds, plus always-show
// `gold` (so the panel doesn't go empty in the rare case the bank only has
// gold-zero — gives the chief a stable surface). When the bank holds zero
// gold AND zero of every other resource, we render a small "Bank is empty"
// note so the chief knows there's nothing to push.
//
// All visual choices route through the theme tokens added in 09.4
// (palette.resource.<r>.main / .contrastText) — no raw hex literals.

import { Box, Button, ButtonGroup, Stack, Typography } from '@mui/material';
import type { PlayerID } from '../../game/types.ts';
import {
  RESOURCES,
  type Resource,
  type ResourceBag,
} from '../../game/resources/types.ts';

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
  // 14.4 — render every resource the bank holds. Gold is forced visible
  // (it's the canonical chief output) so the row layout doesn't flicker
  // when other resources transiently drain to zero between rounds.
  const resourcesShown: Resource[] = RESOURCES.filter(
    (r) => r === 'gold' || (bank[r] ?? 0) > 0,
  );
  const bankEmpty = RESOURCES.every((r) => (bank[r] ?? 0) === 0);

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

      {bankEmpty ? (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted, fontStyle: 'italic' }}
        >
          Bank is empty.
        </Typography>
      ) : null}

      <Stack spacing={1}>
        {resourcesShown.map((resource) => {
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
