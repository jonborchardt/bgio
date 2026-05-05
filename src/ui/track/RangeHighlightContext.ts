// Range-highlight context (non-component) — bridge for the unit-range
// preview overlay.
//
// Background: defense units have a Chebyshev `range` stat that decides
// whether they get a fire opportunity at an incoming threat. The
// village UI never visualised that range, so the table couldn't tell
// at a glance which cells a unit covers. This context lets a
// `<UnitChip>` (or any other consumer that knows a unit id) publish
// "the table is hovering / focusing this unit" upward; the village
// grid reads the id, looks the unit up, and tints every cell within
// the unit's Chebyshev radius.
//
// The context is the simplest possible shape:
//   - `hoveredUnitID`: the unit currently being previewed, or `null`.
//   - `setHoveredUnitID`: setter the chip calls on enter / leave.
//
// Range computation is owned by `BuildingGrid` (it already has the
// `units` list + grid bounds + def lookup). This module is just the
// shared mutable handle.

import { createContext } from 'react';
import type { UnitInstance } from '../../game/roles/defense/types.ts';
import { UNITS } from '../../data/index.ts';

export interface RangeHighlightContextValue {
  /** Unit id currently being previewed, or `null` when nothing is
   *  hovered / focused. */
  hoveredUnitID: string | null;
  /** Setter the consumer calls on hover / focus events. */
  setHoveredUnitID: (id: string | null) => void;
}

export const RangeHighlightContext =
  createContext<RangeHighlightContextValue>({
    hoveredUnitID: null,
    setHoveredUnitID: () => undefined,
  });

/**
 * Compute the cell-keys covered by a unit's Chebyshev range. Returns an
 * empty set when the unit can't be located (bad id, unknown defID) or
 * when its tile coordinate fails to parse — the grid render then just
 * paints no range tint.
 */
export const computeRangeKeys = (
  unitID: string | null,
  units: ReadonlyArray<UnitInstance> | undefined,
): Set<string> => {
  const out = new Set<string>();
  if (unitID === null || units === undefined) return out;
  const unit = units.find((u) => u.id === unitID);
  if (unit === undefined) return out;
  const def = UNITS.find((u) => u.name === unit.defID);
  if (def === undefined) return out;
  const parts = unit.cellKey.split(',');
  if (parts.length !== 2) return out;
  const cx = Number(parts[0]);
  const cy = Number(parts[1]);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return out;
  const range = def.range;
  if (range < 0) return out;
  for (let dx = -range; dx <= range; dx += 1) {
    for (let dy = -range; dy <= range; dy += 1) {
      // Chebyshev radius — every cell whose max(|dx|,|dy|) ≤ range
      // is "in range". The square loop already enforces the bound, so
      // we don't need a redundant check.
      out.add(`${cx + dx},${cy + dy}`);
    }
  }
  return out;
};
