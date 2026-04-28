// CellSlot (06.7) — one cell in the BuildingGrid.
//
// Three rendering states:
//   1. Occupied: shows the placed building's `defID` plus a worker indicator
//      when a chief worker token is on it.
//   2. Empty + isPlacing && isLegal: shows a "+ build" affordance.
//   3. Empty + (!isPlacing || !isLegal): renders a faded outline so the
//      grid layout still has a slot in this position.
//
// All visual choices route through theme tokens.

import { Box, Stack, Typography } from '@mui/material';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';

export interface CellSlotProps {
  x: number;
  y: number;
  building?: DomesticBuilding;
  isLegal: boolean;
  isPlacing: boolean;
  onClick: () => void;
}

export function CellSlot({
  x,
  y,
  building,
  isLegal,
  isPlacing,
  onClick,
}: CellSlotProps) {
  const occupied = building !== undefined;
  const showBuild = !occupied && isPlacing && isLegal;
  const clickable = (occupied) || showBuild;

  return (
    <Box
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-label={
        occupied
          ? `Cell ${x},${y} — ${building.defID}`
          : `Cell ${x},${y} — empty`
      }
      onClick={clickable ? onClick : undefined}
      sx={{
        minHeight: '3.5rem',
        minWidth: '3.5rem',
        px: 0.75,
        py: 0.5,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: (t) =>
          occupied
            ? t.palette.role.domestic.main
            : showBuild
              ? t.palette.role.domestic.light
              : t.palette.status.muted,
        bgcolor: (t) =>
          occupied ? t.palette.card.surface : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        opacity: occupied || showBuild ? 1 : 0.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {occupied ? (
        <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: (t) => t.palette.role.domestic.main,
              fontWeight: 600,
            }}
          >
            {building.defID}
          </Typography>
          {building.upgrades > 0 ? (
            <Typography
              variant="caption"
              sx={{ color: (t) => t.palette.status.muted }}
            >
              +{building.upgrades}
            </Typography>
          ) : null}
          {building.worker !== null ? (
            <Box
              aria-label="Worker"
              sx={{
                width: '0.625rem',
                height: '0.625rem',
                borderRadius: '50%',
                bgcolor: (t) => t.palette.resource.worker.main,
              }}
            />
          ) : null}
        </Stack>
      ) : showBuild ? (
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.role.domestic.main,
            fontWeight: 600,
          }}
        >
          + build
        </Typography>
      ) : (
        <Typography
          variant="caption"
          sx={{ color: (t) => t.palette.status.muted }}
        >
          {x},{y}
        </Typography>
      )}
    </Box>
  );
}

export default CellSlot;
