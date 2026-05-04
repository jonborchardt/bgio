// Defense redesign 3.7 — TeachDialog render tests.
//
// Same pattern as DrillButton.test.tsx — render via renderToStaticMarkup
// + ThemeProvider, assert against the produced HTML. Click-and-dispatch
// behavior depends on @testing-library/react (not installed); the
// disabled-reason logic is covered exhaustively in
// `drillTeachLogic.test.ts`.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { TeachButton } from '../../../src/ui/science/TeachDialog.tsx';
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
  props: Partial<React.ComponentProps<typeof TeachButton>> = {},
): string => {
  const merged: React.ComponentProps<typeof TeachButton> = {
    units: [mkUnit()],
    canAct: true,
    taughtUsed: false,
    stashScience: 5,
    onTeach: noop,
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <TeachButton {...merged} />
    </ThemeProvider>,
  );
};

describe('TeachButton (defense redesign 3.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/TeachDialog.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.TeachButton).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('enabled when seat can act and a skill is affordable', () => {
    const html = render();
    expect(html).toContain('data-teach-button="true"');
    expect(html).toContain('data-teach-disabled="false"');
    expect(html).toContain('data-teach-status="available"');
    expect(html).toContain('Teach: available');
  });

  it('disabled with "used this round" status when the latch is set', () => {
    const html = render({ taughtUsed: true });
    expect(html).toContain('data-teach-disabled="true"');
    expect(html).toContain('data-teach-status="used"');
    expect(html).toContain('Teach: used this round');
  });

  it('disabled when the seat cannot act (off-stage)', () => {
    const html = render({ canAct: false });
    expect(html).toContain('data-teach-disabled="true"');
  });

  it('disabled when no units are on the grid', () => {
    const html = render({ units: [] });
    expect(html).toContain('data-teach-disabled="true"');
  });

  it("disabled when seat can't afford even the cheapest skill", () => {
    const html = render({ stashScience: 0 });
    expect(html).toContain('data-teach-disabled="true"');
  });
});
