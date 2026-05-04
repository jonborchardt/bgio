// Defense redesign 3.6 — PlacementOverlay.
//
// Self-contained "pick a tile" picker for the Defense seat. When a unit
// card is armed in <UnitHand>, the panel renders this overlay listing
// every legal placement target (non-center placed buildings on the
// village grid). Clicking a tile dispatches
// `defenseBuyAndPlace(unitDefID, cellKey)`.
//
// Why not reuse the BuildingGrid placement affordance? In networked
// builds the Defense seat doesn't see the DomesticPanel — only Defense
// is rendered, so the pick must live inside the Defense panel itself.
// In hot-seat the grid is visible too; this overlay still works as the
// primary picker (its tile list mirrors the grid's occupied cells).
//
// Layout: a small wrapping row of buttons, one per placeable cell. Each
// button shows the cell's coordinates + the building's name + the
// number of units already on the tile (so the player can see "stacking
// onto the same tile" at a glance — D13 stack visualization).

import { useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { DomesticBuilding } from '../../game/roles/domestic/types.ts';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { EmbossedFrame } from '../layout/EmbossedFrame.tsx';

export interface PlacementOverlayProps {
  /** Currently-armed unit's name (forwarded so the picker label can name
   *  the unit). When undefined the picker collapses to a hint row. */
  selectedUnitName?: string;
  /** Domestic grid keyed by `cellKey(x, y)`. Reads occupied non-center
   *  cells out of this map. */
  grid: Record<string, DomesticBuilding>;
  /** Defense units currently in play. The picker tallies per-tile counts
   *  so the player sees how the existing stack compares to where they're
   *  about to place. Optional — empty / undefined means no existing
   *  units. */
  units?: ReadonlyArray<UnitInstance>;
  /** Called with a cellKey when the player picks a tile. The panel binds
   *  this to `moves.defenseBuyAndPlace(unitDefID, cellKey)`. */
  onPick: (cellKey: string) => void;
  /** Cancel handler — clears the selection in the parent panel. */
  onCancel: () => void;
}

export function PlacementOverlay({
  selectedUnitName,
  grid,
  units,
  onPick,
  onCancel,
}: PlacementOverlayProps) {
  // Defense redesign 3.9 — Esc cancels the in-flight placement.
  // Mounted unconditionally (the effect early-returns when no unit is
  // armed) so the listener follows the overlay's lifecycle and we don't
  // leak handlers across mount / unmount cycles.
  useEffect(() => {
    if (selectedUnitName === undefined) return;
    const handler = (evt: globalThis.KeyboardEvent): void => {
      if (evt.key !== 'Escape') return;
      // Don't fight inputs / textareas — Esc is sometimes used to clear
      // their value.
      const target = evt.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }
      evt.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [selectedUnitName, onCancel]);

  if (selectedUnitName === undefined) return null;

  // Pull placement targets out of the grid: occupied, non-center cells.
  // Sort by (y desc, x asc) so the topmost-leftmost target leads — same
  // visual order as the rendered village grid.
  const cellKeys = Object.keys(grid)
    .filter((k) => {
      const b = grid[k];
      return b !== undefined && b.isCenter !== true;
    })
    .sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number);
      const [bx, by] = b.split(',').map(Number);
      if (Number.isFinite(ay) && Number.isFinite(by) && ay !== by) {
        return (by ?? 0) - (ay ?? 0);
      }
      return (ax ?? 0) - (bx ?? 0);
    });

  const unitsByCell = new Map<string, number>();
  for (const u of units ?? []) {
    unitsByCell.set(u.cellKey, (unitsByCell.get(u.cellKey) ?? 0) + 1);
  }

  return (
    <EmbossedFrame
      role="defense"
      sx={{ alignSelf: 'stretch' }}
      data-placement-overlay="true"
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: (t) => t.palette.role.defense.light }}
            data-placement-overlay-prompt="true"
          >
            Place {selectedUnitName} on a building tile
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={onCancel}
            aria-label="Cancel placement (Esc)"
            aria-keyshortcuts="Escape"
            data-placement-overlay-cancel="true"
            sx={{
              color: (t) => t.palette.status.muted,
              textTransform: 'none',
            }}
          >
            Cancel <Box component="span" aria-hidden sx={{ opacity: 0.7, ml: 0.5, fontSize: '0.7rem' }}>(Esc)</Box>
          </Button>
        </Stack>
        {cellKeys.length === 0 ? (
          <Typography
            variant="caption"
            data-placement-overlay-empty="true"
            sx={{
              color: (t) => t.palette.status.muted,
              fontStyle: 'italic',
              py: 1,
            }}
          >
            No buildings on the village grid yet — domestic must place a
            building before defense can station a unit.
          </Typography>
        ) : (
          <Stack
            direction="row"
            spacing={0.75}
            data-placement-overlay-targets="true"
            sx={{ flexWrap: 'wrap', rowGap: 0.75 }}
          >
            {cellKeys.map((key) => {
              const b = grid[key]!;
              const stack = unitsByCell.get(key) ?? 0;
              return (
                <Button
                  key={key}
                  variant="outlined"
                  size="small"
                  onClick={() => onPick(key)}
                  data-placement-overlay-target="true"
                  data-cell-key={key}
                  data-unit-stack-count={stack}
                  aria-label={`Place on ${b.defID} at ${key}`}
                  sx={{
                    textTransform: 'none',
                    borderColor: (t) => t.palette.role.defense.dark,
                    color: (t) => t.palette.role.defense.contrastText,
                    '&:hover': {
                      borderColor: (t) => t.palette.role.defense.main,
                      bgcolor: (t) => t.palette.role.defense.dark,
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: 'center' }}
                  >
                    <Box component="span" sx={{ fontWeight: 700 }}>
                      {b.defID}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        color: (t) => t.palette.status.muted,
                        fontSize: '0.7rem',
                      }}
                    >
                      {key}
                    </Box>
                    {stack > 0 ? (
                      <Box
                        component="span"
                        sx={{
                          fontSize: '0.7rem',
                          color: (t) => t.palette.role.defense.light,
                          fontWeight: 700,
                        }}
                      >
                        +{stack} unit{stack === 1 ? '' : 's'}
                      </Box>
                    ) : null}
                  </Stack>
                </Button>
              );
            })}
          </Stack>
        )}
      </Stack>
    </EmbossedFrame>
  );
}

export default PlacementOverlay;
