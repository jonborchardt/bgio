// Defense redesign 3.7 — DrillButton render tests.
//
// Mirrors the existing UI test pattern in this repo: render via
// `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the resulting HTML string. The
// click-and-dispatch behavior (which would require @testing-library/
// react) is covered indirectly by:
//
//   - the pure-logic helpers in `drillTeachLogic.test.ts`, which pin
//     the disabled-reason branches the button consumes, and
//   - a smoke test below that imports the component module without
//     crashing.
//
// What we *do* assert in this file:
//   - The trigger button's data-disabled attribute matches the helper.
//   - The status caption reflects the per-round latch.
//   - The cost label reflects the `drillCost` prop.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { DrillButton } from '../../../src/ui/science/DrillButton.tsx';
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

const render = (
  props: Partial<React.ComponentProps<typeof DrillButton>> = {},
): string => {
  const merged: React.ComponentProps<typeof DrillButton> = {
    units: [mkUnit()],
    canAct: true,
    drillUsed: false,
    stashScience: 5,
    drillCost: 1,
    onDrill: noop,
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <DrillButton {...merged} />
    </ThemeProvider>,
  );
};

describe('DrillButton (defense redesign 3.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/DrillButton.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.DrillButton).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('enabled when seat can act and stash covers cost', () => {
    const html = render();
    expect(html).toContain('data-drill-button="true"');
    expect(html).toContain('data-drill-disabled="false"');
    expect(html).toContain('data-drill-status="available"');
    expect(html).toContain('Drill: available');
    expect(html).toContain('Drill (1 science)');
  });

  it('disabled with "used this round" status when the latch is set', () => {
    const html = render({ drillUsed: true });
    expect(html).toContain('data-drill-disabled="true"');
    expect(html).toContain('data-drill-status="used"');
    expect(html).toContain('Drill: used this round');
  });

  it('disabled when the seat cannot act (off-stage)', () => {
    const html = render({ canAct: false });
    expect(html).toContain('data-drill-disabled="true"');
    // Status is still "available" because the latch hasn't fired.
    expect(html).toContain('data-drill-status="available"');
  });

  it('disabled when no units are on the grid', () => {
    const html = render({ units: [] });
    expect(html).toContain('data-drill-disabled="true"');
  });

  it("disabled when seat can't afford the drill cost", () => {
    const html = render({ stashScience: 0, drillCost: 1 });
    expect(html).toContain('data-drill-disabled="true"');
  });

  it('renders the cost prop in the button label', () => {
    const html = render({ drillCost: 2 });
    expect(html).toContain('Drill (2 science)');
  });
});
