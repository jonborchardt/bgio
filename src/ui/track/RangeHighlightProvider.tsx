// RangeHighlightProvider — owns the hovered-unit state.
//
// Lives in its own component module so the context (data) module stays
// non-component (the `react-refresh/only-export-components` rule
// requires non-component exports to live elsewhere). Mount this once
// near the top of the board so every <UnitChip> publishes into the
// same slot that <BuildingGrid> reads.

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  RangeHighlightContext,
  type RangeHighlightContextValue,
} from './RangeHighlightContext.ts';

export interface RangeHighlightProviderProps {
  children: ReactNode;
}

export function RangeHighlightProvider({
  children,
}: RangeHighlightProviderProps) {
  const [hoveredUnitID, setHoveredUnitID] = useState<string | null>(null);
  const set = useCallback((id: string | null) => {
    setHoveredUnitID(id);
  }, []);
  const value = useMemo<RangeHighlightContextValue>(
    () => ({ hoveredUnitID, setHoveredUnitID: set }),
    [hoveredUnitID, set],
  );
  return (
    <RangeHighlightContext.Provider value={value}>
      {children}
    </RangeHighlightContext.Provider>
  );
}

export default RangeHighlightProvider;
