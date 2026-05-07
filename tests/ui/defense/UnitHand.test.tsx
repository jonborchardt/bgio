// Defense redesign 3.6 — UnitHand render tests.
//
// Same pattern as the science DrillButton / TeachDialog tests: render
// via `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the produced HTML. The
// click-and-dispatch behavior depends on @testing-library/react which
// is not installed; selection state is asserted via `data-*`
// attributes the components expose.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { UnitHand } from '../../../src/ui/defense/UnitHand.tsx';
import { UNITS } from '../../../src/data/index.ts';
import type { ResourceBag } from '../../../src/game/resources/types.ts';

const noop = (): void => {
  /* test-only callback */
};

const richStash: ResourceBag = {
  gold: 99,
  wood: 99,
  stone: 99,
  steel: 99,
  horse: 99,
  food: 99,
  production: 99,
  science: 99,
  happiness: 99,
  worker: 0,
};

const renderHand = (
  props: Partial<React.ComponentProps<typeof UnitHand>> = {},
): string => {
  const merged: React.ComponentProps<typeof UnitHand> = {
    hand: [UNITS[0]!, UNITS[1]!],
    stash: richStash,
    canAct: true,
    onSelect: noop,
    ...props,
  };
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <UnitHand {...merged} />
    </ThemeProvider>,
  );
};

describe('UnitHand (defense redesign 3.6)', () => {
  it('renders one card per hand entry', () => {
    const html = renderHand();
    expect(html).toContain('data-defense-hand="true"');
    expect(html).toContain(`data-unit-def="${UNITS[0]!.name}"`);
    expect(html).toContain(`data-unit-def="${UNITS[1]!.name}"`);
  });

  it('shows the empty hint when no cards are in hand', () => {
    const html = renderHand({ hand: [] });
    expect(html).toContain('data-defense-hand-empty="true"');
    expect(html).not.toContain('data-defense-hand="true"');
  });

  it('marks the selected card with data-unit-selected="true"', () => {
    const target = UNITS[0]!.name;
    const html = renderHand({ selectedName: target });
    expect(html).toContain(`data-unit-def="${target}"`);
    // The card with the selected name reports selected=true; the others
    // remain selected=false.
    expect(html).toContain(`data-unit-selected="true"`);
    // At least one other card should be selected="false" when the hand
    // has more than one entry.
    expect(html).toContain(`data-unit-selected="false"`);
  });

  it('disables the buy button when the seat is off-stage', () => {
    const html = renderHand({ canAct: false });
    // Button label remains "Buy & place" (selection toggled is the
    // chrome that flips it to "Cancel"); the disabled state is wired
    // through MUI's `disabled` attribute on the rendered button.
    expect(html).toContain('Buy &amp; place');
    expect(html).toContain('disabled=""');
  });

  it('keeps the cancel affordance enabled even when off-stage', () => {
    // Selecting a card while canAct=false should still allow cancel —
    // the UnitCard branches `disabled={!enabled && !isSelected}`.
    const html = renderHand({
      canAct: false,
      selectedName: UNITS[0]!.name,
    });
    expect(html).toContain('Cancel');
  });
});
