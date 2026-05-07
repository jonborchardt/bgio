// Defense redesign 3.7 — UnitPicker render tests.
//
// Same render-to-static-markup pattern; covers:
//   - empty state
//   - sorting by placementOrder ascending
//   - per-row disabled-reason caption
//   - dialog-mode wrapper does not render until `open=true`

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import {
  UnitPicker,
  UnitPickerDialog,
} from '../../../src/ui/science/UnitPicker.tsx';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const mkUnit = (overrides: Partial<UnitInstance> = {}): UnitInstance => ({
  id: 'u1',
  defID: 'Brute',
  cellKey: '0,1',
  hp: 2,
  placementOrder: 0,
  ...overrides,
});

const noop = (): void => {
  /* test-only callback */
};

const renderPicker = (props: React.ComponentProps<typeof UnitPicker>): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <UnitPicker {...props} />
    </ThemeProvider>,
  );

describe('UnitPicker (defense redesign 3.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/UnitPicker.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.UnitPicker).toBe('function');
    expect(typeof mod.UnitPickerDialog).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('renders the empty-state hint when there are no units', () => {
    const html = renderPicker({ units: [], onPick: noop });
    expect(html).toContain('data-unit-picker-empty="true"');
    expect(html).toContain('No units on the village grid yet.');
  });

  it('honors a custom emptyHint', () => {
    const html = renderPicker({
      units: [],
      onPick: noop,
      emptyHint: 'Pick a skill above to see eligible units.',
    });
    expect(html).toContain('Pick a skill above to see eligible units.');
  });

  it('renders one row per unit with id, defID, hp, tile, and order', () => {
    const html = renderPicker({
      units: [
        mkUnit({ id: 'u1', defID: 'Brute', placementOrder: 0, cellKey: '0,1' }),
        mkUnit({ id: 'u2', defID: 'Spear', placementOrder: 1, cellKey: '1,0' }),
      ],
      onPick: noop,
    });
    expect(html).toContain('data-unit-id="u1"');
    expect(html).toContain('data-unit-id="u2"');
    expect(html).toContain('Brute');
    expect(html).toContain('Spear');
    expect(html).toContain('tile 0,1');
    expect(html).toContain('tile 1,0');
  });

  it('sorts units by placementOrder ascending in the rendered DOM', () => {
    const html = renderPicker({
      units: [
        mkUnit({ id: 'u-late', placementOrder: 9 }),
        mkUnit({ id: 'u-early', placementOrder: 1 }),
        mkUnit({ id: 'u-mid', placementOrder: 5 }),
      ],
      onPick: noop,
    });
    const earlyIdx = html.indexOf('data-unit-id="u-early"');
    const midIdx = html.indexOf('data-unit-id="u-mid"');
    const lateIdx = html.indexOf('data-unit-id="u-late"');
    expect(earlyIdx).toBeGreaterThan(-1);
    expect(midIdx).toBeGreaterThan(earlyIdx);
    expect(lateIdx).toBeGreaterThan(midIdx);
  });

  it('surfaces a disabled reason for ineligible rows', () => {
    const html = renderPicker({
      units: [
        mkUnit({ id: 'eligible' }),
        mkUnit({ id: 'taken', defID: 'Veteran' }),
      ],
      onPick: noop,
      disabled: (u) =>
        u.id === 'taken' ? 'Veteran already has Sharpen.' : false,
    });
    expect(html).toContain('data-unit-picker-disabled-reason="true"');
    expect(html).toContain('Veteran already has Sharpen.');
  });
});

describe('UnitPickerDialog (defense redesign 3.7)', () => {
  it('renders nothing visible when closed', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme}>
        <UnitPickerDialog
          open={false}
          onClose={noop}
          title="Drill a unit"
          units={[mkUnit()]}
          onPick={noop}
        />
      </ThemeProvider>,
    );
    // MUI's Dialog skips body content when `open={false}`. The component
    // still returns a Portal placeholder; we just verify the title isn't
    // rendered anywhere.
    expect(html).not.toContain('Drill a unit');
  });
});
