// Defense redesign 3.6 — InPlayList render tests.
//
// Verifies the in-play list reflects unit instances (cellKey, hp,
// placementOrder), surfaces the drill marker, and renders one chip per
// taught skill.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { InPlayList } from '../../../src/ui/defense/InPlayList.tsx';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const mkUnit = (overrides: Partial<UnitInstance> = {}): UnitInstance => ({
  id: 'u1',
  defID: 'Brute',
  cellKey: '0,1',
  hp: 2,
  placementOrder: 0,
  ...overrides,
});

const render = (
  props: Partial<React.ComponentProps<typeof InPlayList>> = {},
): string => {
  const merged: React.ComponentProps<typeof InPlayList> = {
    units: [mkUnit()],
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <InPlayList {...merged} />
    </ThemeProvider>,
  );
};

describe('InPlayList (defense redesign 3.6)', () => {
  it('shows the empty hint when no units are placed', () => {
    const html = render({ units: [] });
    expect(html).toContain('data-defense-inplay-empty="true"');
    expect(html).not.toContain('data-defense-inplay-list="true"');
  });

  it('renders one row per unit, sorted by placementOrder', () => {
    const html = render({
      units: [
        mkUnit({ id: 'u2', placementOrder: 5, defID: 'Spear' }),
        mkUnit({ id: 'u1', placementOrder: 1, defID: 'Brute' }),
      ],
    });
    expect(html).toContain('data-defense-inplay-list="true"');
    expect(html).toContain('data-defense-inplay-count="2"');
    // First-rendered row should be the lowest placementOrder.
    const firstIdx = html.indexOf('data-unit-id="u1"');
    const secondIdx = html.indexOf('data-unit-id="u2"');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('surfaces the drill marker when drillToken is true', () => {
    const html = render({
      units: [mkUnit({ drillToken: true })],
    });
    expect(html).toContain('data-unit-drilled="true"');
    expect(html).toContain('data-defense-inplay-drill="true"');
    expect(html).toContain('drilled');
  });

  it('omits the drill marker when drillToken is unset', () => {
    const html = render();
    expect(html).toContain('data-unit-drilled="false"');
    expect(html).not.toContain('data-defense-inplay-drill="true"');
  });

  it('renders a chip per taught skill', () => {
    const html = render({
      units: [mkUnit({ taughtSkills: ['extendRange', 'sharpen'] })],
    });
    expect(html).toContain('data-unit-taught-count="2"');
    expect(html).toContain('data-defense-inplay-skill="extendRange"');
    expect(html).toContain('data-defense-inplay-skill="sharpen"');
  });

  it('shows hp current/max and the cellKey/order summary', () => {
    const html = render({ units: [mkUnit({ hp: 1, cellKey: '2,3', placementOrder: 7 })] });
    expect(html).toMatch(/2,3/);
    expect(html).toMatch(/hp 1/);
    expect(html).toMatch(/#7/);
  });
});
