// Science Library SL 5.1 — LibraryRow / LibraryCardTile render tests.
//
// Mirrors the existing UI test pattern in this repo: render via
// `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the resulting HTML string. Click +
// dispatch behavior would require @testing-library/react and is
// covered indirectly by the move-level tests under
// `tests/game/roles/science/library*.spec.ts`.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { LibraryRow } from '../../../src/ui/library/LibraryRow.tsx';
import type { LibraryState } from '../../../src/game/library/state.ts';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';
import type { BuildingDef, UnitDef } from '../../../src/data/schema.ts';

const noop = (): void => {
  /* test-only callback */
};

const mkBag = (overrides: Partial<ResourceBag> = {}): ResourceBag => ({
  gold: 0,
  production: 0,
  wood: 0,
  stone: 0,
  steel: 0,
  science: 0,
  food: 0,
  worker: 0,
  horse: 0,
  happiness: 0,
  ...overrides,
});

const mkBuildingDef = (overrides: Partial<BuildingDef> = {}): BuildingDef => ({
  name: 'Granary',
  cost: 4,
  benefit: '+1 food/round',
  note: '',
  maxHp: 2,
  ...overrides,
});

const mkUnitDef = (overrides: Partial<UnitDef> = {}): UnitDef => ({
  name: 'Spearman',
  cost: 2,
  initiative: 1,
  attack: 1,
  hp: 1,
  altStats: '',
  requires: '',
  note: '',
  range: 1,
  regen: 0,
  firstStrike: false,
  placementBonus: [],
  ...overrides,
});

const greenT1: LibraryCard = {
  kind: 'building',
  tier: 1,
  scienceColor: 'green',
  def: mkBuildingDef({ name: 'Granary', tier: 1, scienceColor: 'green' }),
};

const redT2: LibraryCard = {
  kind: 'unit',
  tier: 2,
  scienceColor: 'red',
  def: mkUnitDef({ name: 'Cavalry', tier: 2, scienceColor: 'red' }),
};

const emptyLibrary = (): LibraryState => ({
  row: [null, null, null, null, null, null],
  deck: [],
  lostIdeas: [],
  discountTableaus: { '0': [], '1': [] },
});

const mixedLibrary = (): LibraryState => {
  const lib = emptyLibrary();
  lib.row[0] = greenT1;
  lib.row[3] = redT2;
  return lib;
};

const render = (
  props: Partial<React.ComponentProps<typeof LibraryRow>> = {},
): string => {
  const merged: React.ComponentProps<typeof LibraryRow> = {
    library: emptyLibrary(),
    viewerSeat: '0',
    viewerIsScience: true,
    canAct: true,
    viewerStash: mkBag({ wood: 10, stone: 10, steel: 10, science: 10, gold: 10 }),
    onBuy: noop,
    onBurn: noop,
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <LibraryRow {...merged} />
    </ThemeProvider>,
  );
};

describe('LibraryRow (SL 5.1)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/library/LibraryRow.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.LibraryRow).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('empty row renders 6 dashed slots', () => {
    const html = render();
    // One occurrence per slot, indices 0..5.
    for (let i = 0; i < 6; i += 1) {
      expect(html).toContain(`data-library-slot="${i}"`);
      expect(html).toContain(`Library slot ${i + 1}: empty`);
    }
    // 6 empty-state markers.
    const emptyMatches = html.match(/data-library-slot-state="empty"/g) ?? [];
    expect(emptyMatches).toHaveLength(6);
    expect(html).not.toContain('data-library-slot-state="filled"');
  });

  it('mixed row: filled tiles render name, tier badge, color accent', () => {
    const html = render({ library: mixedLibrary() });
    expect(html).toContain('Granary');
    expect(html).toContain('Cavalry');
    // Tier badges.
    expect(html).toContain('>T1<');
    expect(html).toContain('>T2<');
    // Color accent metadata.
    expect(html).toContain('data-library-card-color="green"');
    expect(html).toContain('data-library-card-color="red"');
    expect(html).toContain('data-library-card-tier="1"');
    expect(html).toContain('data-library-card-tier="2"');
    // 2 filled, 4 empty.
    const filledMatches = html.match(/data-library-slot-state="filled"/g) ?? [];
    expect(filledMatches).toHaveLength(2);
    const emptyMatches = html.match(/data-library-slot-state="empty"/g) ?? [];
    expect(emptyMatches).toHaveLength(4);
  });

  it('viewerIsScience=false: no Buy / Burn buttons rendered', () => {
    const html = render({
      library: mixedLibrary(),
      viewerIsScience: false,
      canAct: false,
    });
    expect(html).not.toContain('data-library-buy-button="true"');
    expect(html).not.toContain('data-library-burn-button="true"');
    // The row is still visible to non-science viewers (filled tiles
    // still render their content).
    expect(html).toContain('Granary');
  });

  it('viewerIsScience=true with sufficient stash: Buy enabled', () => {
    const html = render({ library: mixedLibrary() });
    // First filled slot is slot 0 (greenT1). T1 green needs 4 wood.
    // Stash has 10 wood — should be affordable, button enabled.
    expect(html).toContain('data-library-buy-button="true"');
    // At least one Buy button is enabled.
    expect(html).toContain('data-library-buy-disabled="false"');
  });

  it('stash too short for slot 0 cost: Buy disabled with shortfall tooltip', () => {
    const html = render({
      library: mixedLibrary(),
      // greenT1 needs 4 wood; supply 1. Should disable Buy.
      viewerStash: mkBag({ wood: 1 }),
    });
    expect(html).toContain('data-library-buy-disabled="true"');
    // Tooltip text — `renderToStaticMarkup` renders MUI Tooltip's
    // `title` prop to an `aria-label` on the wrapper span when the
    // tooltip is the only labelled element. We assert on the
    // human-readable shortfall string showing up *somewhere* in the
    // HTML (Tooltip injects it as an aria-label / title attr).
    expect(html).toMatch(/Need 4 Wood, have 1/);
  });

  it('canAct=false (off-stage science seat): both buttons disabled', () => {
    const html = render({
      library: mixedLibrary(),
      canAct: false,
    });
    expect(html).toContain('data-library-buy-disabled="true"');
    expect(html).toContain('data-library-burn-disabled="true"');
  });

  it('every filled slot has a discriminating aria-label', () => {
    const html = render({ library: mixedLibrary() });
    expect(html).toContain('Library slot 1: Granary (green T1)');
    expect(html).toContain('Library slot 4: Cavalry (red T2)');
  });

  it('discount tableau reduces the displayed cost', () => {
    // Two greenT1s already in the tableau grant -2 wood. greenT1 base
    // cost is 4 wood; after -2 it's 2 wood (still above the floor of 1).
    const lib = mixedLibrary();
    lib.discountTableaus['0'] = [greenT1, greenT1];
    const html = render({
      library: lib,
      viewerStash: mkBag({ wood: 2 }),
    });
    // Should still be affordable at 2 wood.
    expect(html).toContain('data-library-buy-disabled="false"');
  });
});
