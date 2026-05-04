// Defense redesign 3.3 — BuildingGrid pathHighlight prop tests.
//
// Validates that explicit `pathHighlight` (a Set of cellKeys) forwards
// through CellSlot's `data-cell-on-path` / `data-cell-on-impact`
// attributes, and that the no-op default (no prop, no provider) leaves
// every cell with the falsy attribute.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { BuildingGrid } from '../../../src/ui/domestic/BuildingGrid.tsx';
import {
  CENTER_CELL_KEY,
  cellKey,
} from '../../../src/game/roles/domestic/grid.ts';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';

const center: DomesticBuilding = {
  defID: 'Center',
  upgrades: 0,
  worker: null,
  hp: 99,
  maxHp: 99,
  isCenter: true,
};

const placed = (defID: string, hp = 2): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp,
  maxHp: hp,
});

const renderGrid = (
  pathHighlight?: {
    pathKeys: ReadonlySet<string>;
    impactKeys: ReadonlySet<string>;
  },
): string => {
  const grid: Record<string, DomesticBuilding> = {
    [CENTER_CELL_KEY]: center,
    [cellKey(0, 1)]: placed('Mill'),
    [cellKey(0, 2)]: placed('Granary'),
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <BuildingGrid
        grid={grid}
        onPlace={() => undefined}
        pathHighlight={pathHighlight}
      />
    </ThemeProvider>,
  );
};

describe('BuildingGrid pathHighlight (3.3)', () => {
  it('with no prop or provider, every cell carries on-path="false"', () => {
    const html = renderGrid();
    expect(html).toContain('data-cell-on-path="false"');
    expect(html).not.toContain('data-cell-on-path="true"');
    expect(html).not.toContain('data-cell-on-impact="true"');
  });

  it('cells named in pathKeys carry on-path="true"', () => {
    const html = renderGrid({
      pathKeys: new Set([cellKey(0, 1), cellKey(0, 2)]),
      impactKeys: new Set(),
    });
    expect(html).toContain('data-cell-on-path="true"');
    // The center cell is NOT in pathKeys — confirm it's still false.
    expect(html).toMatch(
      /data-cell-x="0" data-cell-y="0"[^>]*data-cell-on-path="false"/,
    );
  });

  it('cells named in impactKeys carry on-impact="true"', () => {
    const html = renderGrid({
      pathKeys: new Set([cellKey(0, 1)]),
      impactKeys: new Set([cellKey(0, 1)]),
    });
    expect(html).toContain('data-cell-on-impact="true"');
    // The non-impact cell stays false on impact.
    expect(html).toMatch(
      /data-cell-x="0" data-cell-y="2"[^>]*data-cell-on-impact="false"/,
    );
  });
});
