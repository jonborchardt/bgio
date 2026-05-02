// CellSlot — one cell in the BuildingGrid.
//
// Three rendering states:
//   1. Occupied: a small card showing the building's name + benefit summary,
//      with cost / note / upgrade detail in the hover tooltip. A worker
//      indicator paints in the corner when a chief worker token is on it.
//      The cell itself is a transparent wrapper — the inner BuildingCard
//      already paints its own frame + shadow, so the CellSlot adds no
//      "plot border" around it.
//   2. Empty + isPlacing && isLegal: shows a "+ build" affordance with a
//      dashed placement-target outline.
//   3. Empty + (!isPlacing || !isLegal): an invisible spacer so the grid
//      still has a slot in this position. Plot outlines exist only while
//      the player is actively placing a card.
//
// All visual choices route through theme tokens.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import { BUILDINGS } from '../../data/index.ts';
import { BuildingCard } from '../cards/BuildingCard.tsx';
import { ResourceToken } from '../resources/ResourceToken.tsx';

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
  // Only placement targets are interactive. Occupied cells have no click
  // action wired through `onPlace`, so they shouldn't read as buttons.
  const clickable = showBuild;

  const def = building
    ? BUILDINGS.find((b) => b.name === building.defID)
    : undefined;

  const tooltipNodes: ReactNode[] = [];
  if (def) {
    const costEntries: Array<[string, number]> = def.costBag
      ? (Object.entries(def.costBag) as Array<[string, number]>).filter(
          ([, v]) => (v ?? 0) > 0,
        )
      : def.cost > 0
        ? [['gold', def.cost]]
        : [];
    tooltipNodes.push(
      <Box
        key="cost"
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexWrap: 'wrap' }}
      >
        Cost:{' '}
        {costEntries.length === 0 ? (
          'free'
        ) : (
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
          >
            {costEntries.map(([r, v]) => (
              <ResourceToken key={r} resource={r} count={v} size="small" />
            ))}
          </Box>
        )}
      </Box>,
    );
    if (def.note) tooltipNodes.push(<span key="note">{def.note}</span>);
    if (building && building.upgrades > 0) {
      tooltipNodes.push(
        <span key="upgrades">{`Upgrades: +${building.upgrades}`}</span>,
      );
    }
  }
  const tooltip: ReactNode =
    tooltipNodes.length === 0 ? (
      ''
    ) : (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {tooltipNodes.map((node, i) => (
          <Box
            key={i}
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {i > 0 ? <Box component="span" sx={{ mx: 0.5 }}>—</Box> : null}
            {node}
          </Box>
        ))}
      </Stack>
    );

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
        // Plot outlines (the dashed cell border) appear ONLY while a card
        // is being placed. Occupied cells are transparent containers — the
        // inner BuildingCard supplies its own frame + shadow, and adding
        // another outline at the cell level reads as a redundant "plot
        // border" that lingers after placement.
        border: !occupied && isPlacing ? '1px dashed' : 'none',
        borderColor: (t) =>
          showBuild
            ? t.palette.role.domestic.light
            : t.palette.status.muted,
        bgcolor: 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        opacity: occupied || showBuild ? 1 : isPlacing ? 0.5 : 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: occupied ? 'stretch' : 'center',
        justifyContent: occupied ? 'flex-start' : 'center',
        overflow: 'hidden',
        transition: 'transform 120ms, border-color 120ms',
        '&:hover': clickable
          ? {
              transform: 'translateY(-1px)',
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

  return tooltipNodes.length > 0 ? (
    <Tooltip title={tooltip} placement="top">
      {cell}
    </Tooltip>
  ) : (
    cell
  );
}

export default CellSlot;
