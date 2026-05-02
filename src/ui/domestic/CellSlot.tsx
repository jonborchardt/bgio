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

import { Box, Tooltip, Typography } from '@mui/material';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import { BUILDINGS } from '../../data/index.ts';
import { BuildingCard } from '../cards/BuildingCard.tsx';

export interface CellSlotProps {
  x: number;
  y: number;
  building?: DomesticBuilding;
  isLegal: boolean;
  isPlacing: boolean;
  onClick: () => void;
  /** defIDs of the (up to four) orthogonally-adjacent placed buildings.
   *  When present we forward this set to the placed-building card so its
   *  adjacency rules render with active/inactive flags. */
  activeNeighbors?: ReadonlySet<string>;
}

export function CellSlot({
  x,
  y,
  building,
  isLegal,
  isPlacing,
  onClick,
  activeNeighbors,
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
        // Placed buildings render at the `normal` card size so the
        // village reads as a tile grid; the inner BuildingCard's fixed
        // height (CARD_HEIGHT.normal) drives the actual occupied row
        // height. The floor below covers the rare def-missing fallback
        // and keeps empty cells short so the grid doesn't dominate the
        // panel before the player has built much.
        minHeight: occupied ? '240px' : '5.25rem',
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
          {def ? (
            <BuildingCard
              def={def}
              count={building.upgrades > 0 ? building.upgrades + 1 : undefined}
              size="normal"
              activeNeighbors={activeNeighbors}
            />
          ) : (
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, p: 0.5 }}
            >
              {building.defID}
            </Typography>
          )}
          {building.worker !== null ? (
            <Box
              aria-label="Worker"
              sx={{
                position: 'absolute',
                bottom: 4,
                left: 4,
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
