// CellSlot — one cell in the BuildingGrid.
//
// Three rendering states:
//   1. Occupied: a small card showing the building's name + benefit summary,
//      with cost / note / upgrade detail in the hover tooltip. A worker
//      indicator paints in the corner when a chief worker token is on it.
//   2. Empty + isPlacing && isLegal: shows a "+ build" affordance.
//   3. Empty + (!isPlacing || !isLegal): renders a faded outline so the
//      grid layout still has a slot in this position.
//
// All visual choices route through theme tokens.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import { BUILDINGS } from '../../data/index.ts';

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

  const def = building
    ? BUILDINGS.find((b) => b.name === building.defID)
    : undefined;

  const tooltipParts: string[] = [];
  if (def) {
    if (def.costBag) {
      const parts: string[] = [];
      for (const [r, v] of Object.entries(def.costBag)) {
        if ((v ?? 0) > 0) parts.push(`${v} ${r}`);
      }
      tooltipParts.push(`Cost: ${parts.length > 0 ? parts.join(', ') : 'free'}`);
    } else {
      tooltipParts.push(`Cost: ${def.cost}g`);
    }
    if (def.note) tooltipParts.push(def.note);
    if (building && building.upgrades > 0) {
      tooltipParts.push(`Upgrades: +${building.upgrades}`);
    }
  }
  const tooltip = tooltipParts.join(' — ');

  const cell = (
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
        position: 'relative',
        minHeight: '5.25rem',
        width: '100%',
        borderRadius: 1.5,
        border: occupied ? '1px solid' : '1px dashed',
        borderColor: (t) =>
          occupied
            ? t.palette.role.domestic.dark
            : showBuild
              ? t.palette.role.domestic.light
              : t.palette.status.muted,
        bgcolor: (t) =>
          occupied ? t.palette.card.surface : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        opacity: occupied || showBuild ? 1 : 0.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: occupied ? 'stretch' : 'center',
        justifyContent: occupied ? 'flex-start' : 'center',
        overflow: 'hidden',
        boxShadow: occupied ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
        transition: 'transform 120ms, box-shadow 120ms, border-color 120ms',
        '&:hover': clickable
          ? {
              transform: 'translateY(-1px)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
              borderColor: (t) => t.palette.role.domestic.light,
            }
          : undefined,
      }}
    >
      {occupied ? (
        <>
          <Box
            sx={{
              px: 0.75,
              py: 0.5,
              bgcolor: (t) => t.palette.role.domestic.dark,
              color: (t) => t.palette.role.domestic.contrastText,
              borderBottom: '1px solid',
              borderColor: (t) => t.palette.role.domestic.light,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 0.2,
              }}
            >
              {building.defID}
            </Typography>
            {building.upgrades > 0 ? (
              <Typography
                variant="caption"
                sx={{ fontWeight: 700 }}
              >
                +{building.upgrades}
              </Typography>
            ) : null}
          </Box>
          <Stack
            sx={{
              flex: 1,
              px: 0.75,
              py: 0.5,
              justifyContent: 'flex-start',
            }}
          >
            {def?.benefit ? (
              <Typography
                variant="caption"
                sx={{
                  color: (t) => t.palette.card.text,
                  lineHeight: 1.3,
                  opacity: 0.95,
                  wordBreak: 'break-word',
                }}
              >
                {def.benefit}
              </Typography>
            ) : null}
          </Stack>
          {building.worker !== null ? (
            <Box
              aria-label="Worker"
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: '0.625rem',
                height: '0.625rem',
                borderRadius: '50%',
                bgcolor: (t) => t.palette.resource.worker.main,
                boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
              }}
            />
          ) : null}
        </>
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
      ) : null}
    </Box>
  );

  return tooltip ? (
    <Tooltip title={tooltip} placement="top">
      {cell}
    </Tooltip>
  ) : (
    cell
  );
}

export default CellSlot;
