// VillagePlacementContext (post-3.9 preference sweep) — bridge for the
// shared village-grid placement state.
//
// Background: the BuildingGrid was lifted out of DomesticPanel /
// DefensePanel into the board-level layout so every seat can see the
// village + watch threat resolution animations. The grid is a single
// presentational component, but two role panels still own the
// "I have a card armed" decision (Domestic for buildings, Defense for
// units). This context lets the panels publish that selection to the
// board's grid without prop-drilling, and lets the grid clear it when
// a click resolves.
//
// Only one of the two slots is meaningful at a time: in hot-seat the
// active seat picker drives one role's panel; in networked the local
// player only owns one role's panel. Both slots default to `undefined`
// and the grid silently no-ops when nothing is armed (read-only view).
//
// The grid never dispatches moves directly; it calls `onPlaceBuilding`
// / `onPickUnitCell` and the board (which holds `props.moves`) routes
// to the right move. That keeps the grid a presentation component the
// rest of the codebase can reuse without dragging the entire bgio
// move surface along.

import { createContext } from 'react';

export interface VillagePlacementContextValue {
  /** Building name the domestic seat has armed for placement. */
  selectedBuildingName: string | undefined;
  setSelectedBuildingName: (name: string | undefined) => void;
  /** Unit name the defense seat has armed for placement. */
  selectedUnitName: string | undefined;
  setSelectedUnitName: (name: string | undefined) => void;
}

const noop = (): void => {
  /* default no-op so consumers reading the context outside a
   * Provider (e.g. headless tests) don't crash. */
};

export const VillagePlacementContext =
  createContext<VillagePlacementContextValue>({
    selectedBuildingName: undefined,
    setSelectedBuildingName: noop,
    selectedUnitName: undefined,
    setSelectedUnitName: noop,
  });
