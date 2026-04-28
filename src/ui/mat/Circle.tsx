// Circle (09.3) — a single per-player resource circle on the CenterMat.
//
// Renders a MUI Paper labeled with the seat number, painted with the seat's
// role accent if available (chief seats own no circle, so the typical accent
// here is one of science / domestic / foreign). When `canPull` is true the
// whole tile becomes a ButtonBase that fires `onPull`.

import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import type { PlayerID } from '../../game/types.ts';
import type { ResourceBag as ResourceBagType } from '../../game/resources/types.ts';
import { ResourceBag } from '../resources/ResourceBag.tsx';

export interface CircleProps {
  seat: PlayerID;
  bag: ResourceBagType;
  canPull?: boolean;
  onPull?: () => void;
  // Optional role-accent hint — caller picks one of the four roles to color
  // the border. Falls back to the neutral surface color when unset.
  accentRole?: 'science' | 'domestic' | 'foreign';
}

export function Circle({ seat, bag, canPull, onPull, accentRole }: CircleProps) {
  const inner = (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      <Typography
        variant="caption"
        sx={{ color: (t) => t.palette.status.muted, fontWeight: 600 }}
      >
        Seat {Number(seat) + 1}
      </Typography>
      <ResourceBag bag={bag} size="sm" />
    </Stack>
  );

  const paperSx = {
    px: 1.5,
    py: 1,
    minWidth: '8rem',
    bgcolor: (t: import('@mui/material/styles').Theme) =>
      t.palette.card.surface,
    border: '1px solid',
    borderColor: (t: import('@mui/material/styles').Theme) =>
      accentRole ? t.palette.role[accentRole].main : t.palette.card.surface,
    borderRadius: 1,
  } as const;

  if (canPull && onPull) {
    return (
      <ButtonBase
        onClick={onPull}
        aria-label={`Pull from seat ${Number(seat) + 1} circle`}
        sx={{ display: 'block', textAlign: 'left', width: 'fit-content' }}
      >
        <Box sx={paperSx}>{inner}</Box>
      </ButtonBase>
    );
  }

  return (
    <Paper elevation={0} aria-label={`Seat ${Number(seat) + 1} circle`} sx={paperSx}>
      {inner}
    </Paper>
  );
}

export default Circle;
