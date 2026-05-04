// CellSlot — one cell in the BuildingGrid.
//
// Four rendering states:
//   1. Center tile (`building.isCenter === true`): renders the
//      <CenterTile> visualizer (defense redesign D2 / 3.2). No HP pips,
//      no place affordance — the center vault is permanent and not
//      build-targetable.
//   2. Occupied (regular building): renders <BuildingTile>, which
//      stacks the canonical BuildingCard, an HpPips row, and a
//      <UnitStack> for any defense units placed on this cell. The cell
//      itself is a transparent wrapper — BuildingTile owns its own
//      frame, shadow, and damage / repair flash.
//   3. Empty + isPlacing && isLegal: shows a "+ build" affordance with
//      a dashed placement-target outline.
//   4. Empty + (!isPlacing || !isLegal): an invisible spacer so the
//      grid still has a slot in this position. Plot outlines exist
//      only while the player is actively placing a card.
//
// All visual choices route through theme tokens.

import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { BUILDINGS } from '../../data/index.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { BuildingTile } from './BuildingTile.tsx';
import { CenterTile } from './CenterTile.tsx';

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
  /** Defense redesign 3.2 — defense units placed on THIS cell, sorted
   *  by `placementOrder` ascending. Empty / undefined means no stack. */
  units?: UnitInstance[];
  /** Pooled stash total — only consumed when this cell is the center
   *  tile. Computed by the caller (DomesticPanel) from the non-chief
   *  seats' stashes. */
  pooledTotal?: number;
  /** Optional per-resource breakdown for the center-tile tooltip. */
  pooledBreakdown?: Array<{ resource: string; amount: number }>;
}

export function CellSlot({
  x,
  y,
  building,
  isLegal,
  isPlacing,
  onClick,
  activeNeighbors,
  units,
  pooledTotal,
  pooledBreakdown,
}: CellSlotProps) {
  const occupied = building !== undefined;
  const isCenter = occupied && building.isCenter === true;
  const showBuild = !occupied && isPlacing && isLegal;
  // Only placement targets are interactive. Occupied cells have no click
  // action wired through `onPlace`, so they shouldn't read as buttons.
  const clickable = showBuild;

  const def =
    occupied && !isCenter
      ? BUILDINGS.find((b) => b.name === building.defID)
      : undefined;

  // Tooltip content for regular occupied tiles. The HP row is now
  // visualized inline via HpPips on the BuildingTile, so the tooltip
  // body focuses on cost / note / upgrade detail and skips the
  // "HP X/Y" line that the 1.3 stub printed.
  const tooltipNodes: ReactNode[] = [];
  if (def && occupied && !isCenter) {
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
    if (building.upgrades > 0) {
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

  // Build the tile body. Branches:
  //   - occupied + isCenter → CenterTile
  //   - occupied + regular  → BuildingTile (with HpPips + UnitStack)
  //   - empty + showBuild   → "+ build" placeholder
  //   - empty + idle        → invisible spacer
  const body: ReactNode = (() => {
    if (occupied && isCenter) {
      return (
        <CenterTile
          pooledTotal={pooledTotal ?? 0}
          pooledBreakdown={pooledBreakdown}
        />
      );
    }
    if (occupied) {
      return (
        <BuildingTile
          building={building}
          def={def}
          units={units}
          activeNeighbors={activeNeighbors}
        />
      );
    }
    if (showBuild) {
      return (
        <Typography
          variant="caption"
          sx={{
            color: (t) => t.palette.role.domestic.main,
            fontWeight: 600,
          }}
        >
          + build
        </Typography>
      );
    }
    return null;
  })();

  const cell = (
    <Box
      role="button"
      tabIndex={clickable ? 0 : -1}
      data-cell-x={x}
      data-cell-y={y}
      data-cell-occupied={occupied ? 'true' : 'false'}
      data-cell-center={isCenter ? 'true' : 'false'}
      aria-label={
        occupied
          ? isCenter
            ? `Cell ${x},${y} — village vault`
            : `Cell ${x},${y} — ${building.defID} (HP ${building.hp}/${building.maxHp})`
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
        // inner BuildingTile / CenterTile supplies its own frame + shadow.
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
        overflow: 'visible',
        transition: 'transform 120ms, border-color 120ms',
        '&:hover': clickable
          ? {
              transform: 'translateY(-1px)',
              borderColor: (t) => t.palette.role.domestic.light,
            }
          : undefined,
      }}
    >
      {body}
      {/* Worker indicator stays on the cell wrapper so it floats above
          the inner tile regardless of which kind of tile renders. The
          center vault never carries a worker, so the guard skips it. */}
      {occupied && !isCenter && building.worker !== null ? (
        <Box
          aria-label="Labor"
          sx={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            width: '0.625rem',
            height: '0.625rem',
            borderRadius: '50%',
            bgcolor: (t) => t.palette.resource.worker.main,
            boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
            zIndex: 3,
          }}
        />
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
