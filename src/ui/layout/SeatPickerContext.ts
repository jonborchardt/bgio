// SeatPickerContext (14.1) — bridge between App.tsx (which owns the
// hot-seat seat state) and Board.tsx (which renders the SeatPicker).
//
// Why a context instead of threading the callback as a Board prop:
// the bgio React `Client` factory only passes its own BoardProps shape
// to the rendered board — there is no first-class slot for "extra
// props". A React Context bypasses that constraint cleanly and keeps
// App.tsx the single source of truth for which seat the local viewer
// is driving.
//
// Networked mode never provides this context, so consumers see
// `undefined` and the SeatPicker falls back to its read-only badge
// rendering.

import { createContext } from 'react';
import type { PlayerID } from '../../game/types.ts';

export interface SeatPickerContextValue {
  setSeat: (seat: PlayerID) => void;
}

export const SeatPickerContext = createContext<SeatPickerContextValue | null>(
  null,
);
