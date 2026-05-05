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

import { Box, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { BUILDINGS } from '../../data/index.ts';
import { BuildingCard } from '../cards/BuildingCard.tsx';
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
  /** Defense redesign 3.3 — `true` when this cell is on the currently-
   *  animating threat path. Renders a soft trail tint. */
  onPath?: boolean;
  /** Defense redesign 3.3 — `true` when this cell is on the currently-
   *  animating threat's impact list. Renders a saturated pulse. */
  onImpact?: boolean;
  /** Post-3.9 preference sweep — when true, this cell is an active
   *  unit-placement target (defense seat is stationing a unit). The
   *  cell becomes clickable + shows a defense-accent outline so the
   *  player can see "click here to drop your unit." */
  isUnitTarget?: boolean;
  /** `true` when this cell is currently being highlighted as part of a
   *  hovered/focused unit's Chebyshev range. Renders a defense-accent
   *  outline tint that does not capture clicks. */
  inRange?: boolean;
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
  onPath = false,
  onImpact = false,
  isUnitTarget = false,
  inRange = false,
}: CellSlotProps) {
  const occupied = building !== undefined;
  const isCenter = occupied && building.isCenter === true;
  const showBuild = !occupied && isPlacing && isLegal;
  // Building-placement targets (empty legal cells while placing) and
  // unit-placement targets (occupied non-center cells while a defense
  // unit is armed) are both interactive.
  const clickable = showBuild || isUnitTarget;

  const def =
    occupied && !isCenter
      ? BUILDINGS.find((b) => b.name === building.defID)
      : undefined;

  // Hover detail for regular occupied tiles. The placed-tile card on
  // the grid intentionally drops cost / adjacency rule text to keep the
  // 110×90 footprint readable; this tooltip surfaces the canonical
  // BuildingCard at full detail so the player can hover to see cost,
  // adjacency rules, flavour, and any upgrade count without leaving
  // the grid view.
  const showDetailHover = def !== undefined && occupied && !isCenter;
  const detailHover: ReactNode = showDetailHover ? (
    <BuildingCard def={def} size="detailed" activeNeighbors={activeNeighbors} />
  ) : null;

  // Build the tile body. Branches:
  //   - occupied + isCenter → CenterTile
  //   - occupied + regular  → BuildingTile (with HpPips + UnitStack)
  //   - empty + showBuild   → "+ build" affordance
  //   - empty + idle        → "Field" placeholder so the table can see
  //                            the playable area at all times (physical-
  //                            board metaphor)
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
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.04em',
          }}
        >
          + build
        </Typography>
      );
    }
    return (
      <Typography
        variant="caption"
        aria-hidden
        sx={{
          color: (t) => t.palette.status.muted,
          fontStyle: 'italic',
          fontSize: '0.65rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.55,
        }}
      >
        field
      </Typography>
    );
  })();

  const cell = (
    <Box
      role="button"
      tabIndex={clickable ? 0 : -1}
      data-cell-x={x}
      data-cell-y={y}
      data-cell-occupied={occupied ? 'true' : 'false'}
      data-cell-center={isCenter ? 'true' : 'false'}
      data-cell-on-path={onPath ? 'true' : 'false'}
      data-cell-on-impact={onImpact ? 'true' : 'false'}
      data-cell-unit-target={isUnitTarget ? 'true' : 'false'}
      data-cell-in-range={inRange ? 'true' : 'false'}
      aria-label={
        occupied
          ? isCenter
            ? `Cell ${x},${y} — village vault`
            : isUnitTarget
              ? `Cell ${x},${y} — ${building.defID} (HP ${building.hp}/${building.maxHp}) — click to station unit here`
              : `Cell ${x},${y} — ${building.defID} (HP ${building.hp}/${building.maxHp})`
          : `Cell ${x},${y} — empty`
      }
      onClick={clickable ? onClick : undefined}
      sx={{
        position: 'relative',
        // Every cell is hard-pinned to the `small` BuildingCard
        // footprint (110×90) so the village reads as a uniform board:
        // empty fields, occupied buildings, and the vault all sit at
        // the same height.
        width: '110px',
        height: '90px',
        borderRadius: 1.5,
        // Empty cells always carry a faint dashed outline so the table
        // can see "this is a plot." Legal placement targets get the
        // domestic accent; unit-placement targets get the defense
        // accent. Occupied cells stay transparent (the inner tile
        // supplies its own frame).
        border: occupied
          ? isUnitTarget
            ? '2px dashed'
            : 'none'
          : '1px dashed',
        borderColor: (t) =>
          isUnitTarget
            ? t.palette.role.defense.light
            : showBuild
              ? t.palette.role.domestic.light
              : t.palette.status.muted,
        bgcolor: 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        // Empty fields render at reduced opacity so they recede behind
        // the placed buildings.
        opacity: occupied ? 1 : showBuild ? 1 : 0.7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: occupied ? 'stretch' : 'center',
        justifyContent: occupied ? 'flex-start' : 'center',
        overflow: 'visible',
        transition: 'transform 120ms, border-color 120ms',
        '&:hover': clickable
          ? {
              transform: 'translateY(-1px)',
              borderColor: (t) =>
                isUnitTarget
                  ? t.palette.role.defense.main
                  : t.palette.role.domestic.light,
            }
          : undefined,
      }}
    >
      {body}
      {/* Range-preview tint. Layered below the path-resolution tints so
          a mid-attack animation stays legible if the player is hovering
          a unit at the same time. The inset dashed ring + low-opacity
          fill reads as "this cell is in range" without competing with
          the saturated impact pulse. */}
      {inRange ? (
        <Box
          aria-hidden
          data-testid="range-cell-tint"
          sx={(t) => ({
            position: 'absolute',
            inset: 0,
            borderRadius: 1.5,
            pointerEvents: 'none',
            zIndex: 3,
            bgcolor: alpha(t.palette.role.defense.light, 0.12),
            boxShadow: `inset 0 0 0 2px ${alpha(
              t.palette.role.defense.light,
              0.7,
            )}`,
          })}
        />
      ) : null}
      {/* Defense redesign 3.3 — path / impact tints. The cell stays
          interactive (the tints don't capture clicks) and clears
          automatically when the consumer drops `onPath` / `onImpact`. */}
      {onPath || onImpact ? (
        <Box
          aria-hidden
          data-testid="path-cell-tint"
          sx={(t) => ({
            position: 'absolute',
            inset: 0,
            borderRadius: 1.5,
            pointerEvents: 'none',
            zIndex: 4,
            // Impact pulse beats the trail tint when both apply.
            bgcolor: onImpact
              ? alpha(t.palette.pathOverlay.pathImpact, 0.2)
              : alpha(t.palette.pathOverlay.pathTrail, 0.12),
            boxShadow: onImpact
              ? `inset 0 0 0 2px ${t.palette.pathOverlay.pathImpact}`
              : undefined,
            // Tints fade in once and *hold* for the duration of the
            // current playback step — the resolve-animation provider
            // clears the highlight set when the trace finishes, which
            // unmounts the tint and removes the visual cleanly. (The
            // earlier 350ms pulse-and-fade behaved correctly for the
            // single-shot animation we used to ship; with click-paced
            // steps the table needs the cells to stay lit while they
            // read the banner.)
            animation: onImpact
              ? 'pathTilePulseIn 220ms ease-out forwards'
              : 'pathTileTrailIn 220ms ease-out forwards',
            '@keyframes pathTilePulseIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 1 },
            },
            '@keyframes pathTileTrailIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 0.85 },
            },
          })}
        />
      ) : null}
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

  return showDetailHover ? (
    <Tooltip
      title={detailHover}
      placement="top"
      enterDelay={250}
      enterNextDelay={150}
      slotProps={{
        tooltip: {
          sx: {
            // Detailed BuildingCard is 260×340 — drop the default
            // tooltip padding/background so the card renders cleanly.
            bgcolor: 'transparent',
            p: 0,
            maxWidth: 'none',
          },
        },
      }}
    >
      {cell}
    </Tooltip>
  ) : (
    cell
  );
}

export default CellSlot;
