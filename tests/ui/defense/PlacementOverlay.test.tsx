// Defense redesign 3.6 — PlacementOverlay render tests.
//
// Asserts the overlay's behavior against the produced HTML: it
// collapses to nothing without a selected unit, renders one button per
// non-center occupied cell when armed, and surfaces existing unit-
// stack counts on each target.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { PlacementOverlay } from '../../../src/ui/defense/PlacementOverlay.tsx';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const noop = (): void => {
  /* test-only callback */
};

const mkBuilding = (
  defID: string,
  overrides: Partial<DomesticBuilding> = {},
): DomesticBuilding => ({
  defID,
  upgrades: 0,
  worker: null,
  hp: 2,
  maxHp: 2,
  ...overrides,
});

const sampleGrid: Record<string, DomesticBuilding> = {
  '0,0': mkBuilding('Vault', { isCenter: true, hp: 99, maxHp: 99 }),
  '1,0': mkBuilding('Tower'),
  '0,1': mkBuilding('Well'),
};

const render = (
  props: Partial<React.ComponentProps<typeof PlacementOverlay>> = {},
): string => {
  const merged: React.ComponentProps<typeof PlacementOverlay> = {
    selectedUnitName: 'Brute',
    grid: sampleGrid,
    onPick: noop,
    onCancel: noop,
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <PlacementOverlay {...merged} />
    </ThemeProvider>,
  );
};

describe('PlacementOverlay (defense redesign 3.6)', () => {
  it('renders nothing when no unit is selected', () => {
    const html = render({ selectedUnitName: undefined });
    expect(html).toBe('');
  });

  it('renders one target button per non-center occupied cell', () => {
    const html = render();
    expect(html).toContain('data-placement-overlay="true"');
    expect(html).toContain('data-cell-key="1,0"');
    expect(html).toContain('data-cell-key="0,1"');
    // Center tile (0,0) is excluded.
    expect(html).not.toContain('data-cell-key="0,0"');
  });

  it('shows the empty state when the grid has no placeable buildings', () => {
    const onlyCenter: Record<string, DomesticBuilding> = {
      '0,0': mkBuilding('Vault', { isCenter: true, hp: 99, maxHp: 99 }),
    };
    const html = render({ grid: onlyCenter });
    expect(html).toContain('data-placement-overlay-empty="true"');
    expect(html).not.toContain('data-placement-overlay-target="true"');
  });

  it('reports the existing unit stack count on a target tile', () => {
    const units: UnitInstance[] = [
      {
        id: 'u1',
        defID: 'Brute',
        cellKey: '1,0',
        hp: 2,
        placementOrder: 0,
      },
      {
        id: 'u2',
        defID: 'Spear',
        cellKey: '1,0',
        hp: 1,
        placementOrder: 1,
      },
    ];
    const html = render({ units });
    expect(html).toContain('data-cell-key="1,0"');
    // The tile reports a stack count of 2 via data attribute + label.
    expect(html).toContain('data-unit-stack-count="2"');
    expect(html).toMatch(/\+2 unit/);
  });

  it('names the selected unit in the prompt', () => {
    const html = render({ selectedUnitName: 'Watchman' });
    expect(html).toContain('data-placement-overlay-prompt="true"');
    expect(html).toContain('Place Watchman on a building tile');
  });

  it('exposes a cancel control', () => {
    const html = render();
    expect(html).toContain('data-placement-overlay-cancel="true"');
  });
});
