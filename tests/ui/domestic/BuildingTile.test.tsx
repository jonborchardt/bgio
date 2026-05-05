// Defense redesign 3.2 — BuildingTile damage / repair flash tests.
//
// The flash relies on `useEffect`, which only fires under a real
// React render path. We use `react-dom/client` + React's `act`
// helper rather than `renderToStaticMarkup`. jsdom is configured by
// `vite.config.ts`'s vitest entry.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { BuildingTile } from '../../../src/ui/domestic/BuildingTile.tsx';
import type { DomesticBuilding } from '../../../src/game/roles/domestic/types.ts';
import { BUILDINGS } from '../../../src/data/index.ts';

// Tell React 19 we're in a test environment so `act(...)` doesn't emit
// the "current testing environment is not configured to support
// act(...)" warning. The flag is the documented opt-in for non-RTL
// test setups.
declare global {
   
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const someBuildingDef = BUILDINGS[0]!;

const buildingFor = (
  hp: number,
  maxHp: number,
): DomesticBuilding => ({
  defID: someBuildingDef.name,
  upgrades: 0,
  worker: null,
  hp,
  maxHp,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const renderTile = (building: DomesticBuilding): void => {
  act(() => {
    root.render(
      <ThemeProvider theme={theme}>
        <BuildingTile building={building} def={someBuildingDef} />
      </ThemeProvider>,
    );
  });
};

describe('BuildingTile flash (defense redesign 3.2)', () => {
  it('renders with no flash on first mount', () => {
    renderTile(buildingFor(4, 4));
    const tile = container.querySelector('[data-building-tile="true"]');
    expect(tile).not.toBeNull();
    expect(tile!.getAttribute('data-flash')).toBe('none');
  });

  it('flashes red ("damage") when hp decreases between renders', () => {
    renderTile(buildingFor(4, 4));
    // Re-render with lower hp — the BuildingTile's useEffect should
    // flip data-flash="damage" until the timeout clears it.
    renderTile(buildingFor(2, 4));
    const tile = container.querySelector('[data-building-tile="true"]');
    expect(tile).not.toBeNull();
    expect(tile!.getAttribute('data-flash')).toBe('damage');
    // hp/maxHp data attributes are updated in lockstep so callers can
    // distinguish "hp 2/4 in mid-flash" from "always was hp 2/4".
    expect(tile!.getAttribute('data-building-hp')).toBe('2');
  });

  it('flashes green ("repair") when hp increases between renders', () => {
    renderTile(buildingFor(2, 4));
    renderTile(buildingFor(3, 4));
    const tile = container.querySelector('[data-building-tile="true"]');
    expect(tile).not.toBeNull();
    expect(tile!.getAttribute('data-flash')).toBe('repair');
  });

  it('renders the HP pip row reflecting current/maxHp', () => {
    renderTile(buildingFor(1, 4));
    // Pip group lives inside the tile; assert its state via the
    // documented data attributes.
    const pips = container.querySelector('[data-hp-current]');
    expect(pips).not.toBeNull();
    expect(pips!.getAttribute('data-hp-current')).toBe('1');
    expect(pips!.getAttribute('data-hp-max')).toBe('4');
    expect(pips!.getAttribute('data-hp-state')).toBe('critical');
  });
});
