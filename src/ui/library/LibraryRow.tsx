// Science Library SL 5.1 — LibraryRow.
//
// The 6-slot face-up market on the central board. Reads `G.library`
// (the `LibraryState` slice from SL 2.1), the viewer's seat, the
// viewer's stash, and a `canAct` flag — then resolves each slot's
// effective research cost (post-discount for the science-seat viewer)
// and renders a row of LibraryCardTiles.
//
// Wiring into the central board is sub-plan 5.4's job. This file ships
// only the row component itself + the per-slot tile from
// `LibraryCardTile.tsx`. Picking the central-board placement is the
// 5.4 plan: per the master plan it sits as a sibling between the track
// strip and the village grid, but the central board's `header` slot is
// also a workable surface.
//
// The row is presentational and always visible to the table — the
// face-up market reads at-a-glance for every seat. Buy / Burn buttons
// are only rendered for the science seat.

import { Box, Stack, Typography } from '@mui/material';
import type { LibraryState } from '../../game/library/state.ts';
import type { ResourceBag } from '../../game/resources/types.ts';
import { EMPTY_BAG } from '../../game/resources/types.ts';
import { effectiveResearchCost } from '../../game/library/costs.ts';
import { LibraryCardTile } from './LibraryCardTile.tsx';

// PlayerID is a bgio convention (string seat key). We re-declare it
// here as `string | null` instead of importing from `../../game/types`
// so this file stays free of cross-module type churn — the row only
// uses the seat as a key into `library.discountTableaus`.
export type ViewerSeat = string | null;

export interface LibraryRowProps {
  library: LibraryState;
  /** Viewer's seat key, or `null` when the viewer is a spectator. */
  viewerSeat: ViewerSeat;
  /** True when the viewer's role assignment includes `science`. Drives
   *  which slots render their Buy / Burn buttons. */
  viewerIsScience: boolean;
  /** True when the viewer is the science seat AND active in
   *  `scienceTurn` AND has not yet ended their turn. Buttons are
   *  disabled when false even if `viewerIsScience` is true (e.g. the
   *  science seat reading the row outside their turn). */
  canAct: boolean;
  /** Viewer's stash bag. Used by tiles to gate the Buy button + build
   *  the shortfall tooltip. */
  viewerStash: ResourceBag;
  onBuy: (slotIndex: number) => void;
  onBurn: (slotIndex: number) => void;
}

export function LibraryRow({
  library,
  viewerSeat,
  viewerIsScience,
  canAct,
  viewerStash,
  onBuy,
  onBurn,
}: LibraryRowProps) {
  // Resolve the viewer's discount tableau. A non-science viewer or a
  // missing-seat lookup falls through to an empty tableau; the cost
  // they see is the base cost, which is fine — only the science seat's
  // own tableau drives discounts they can actually exercise.
  const tableau =
    viewerSeat !== null && viewerIsScience
      ? library.discountTableaus[viewerSeat] ?? []
      : [];

  // Stash defaults to an empty bag so a spectator viewer doesn't end
  // up looking at an undefined-resource buy state.
  const stash = viewerStash ?? EMPTY_BAG;

  return (
    <Box
      data-testid="library-row"
      role="region"
      aria-label="Science Library"
      sx={{ minWidth: 0 }}
    >
      <Typography
        variant="overline"
        sx={{
          color: (t) => t.palette.role.science.light,
          fontWeight: 700,
          letterSpacing: 0.6,
          display: 'block',
          mb: 0.5,
        }}
      >
        Library
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          flexWrap: 'wrap',
          rowGap: 1,
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
      >
        {library.row.map((card, slotIndex) => {
          const effective =
            card === null ? EMPTY_BAG : effectiveResearchCost(card, tableau);
          return (
            <LibraryCardTile
              key={slotIndex}
              card={card}
              slotIndex={slotIndex}
              effectiveCost={effective}
              viewerStash={stash}
              canAct={canAct}
              viewerIsScience={viewerIsScience}
              onBuy={onBuy}
              onBurn={onBurn}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

export default LibraryRow;
