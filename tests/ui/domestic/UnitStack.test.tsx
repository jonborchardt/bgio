// Defense redesign 3.2 — UnitStack render tests.
//
// D13: first-placed unit must read as the visually bottom-most. We
// render with `flexDirection: 'column-reverse'`, so the DOM order
// itself reflects oldest-first; the visual stack is column-reverse
// of that. We assert both ordering and the "+N more" overflow badge
// for stacks > 3.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { UnitStack } from '../../../src/ui/domestic/UnitStack.tsx';
import type { UnitInstance } from '../../../src/game/roles/defense/types.ts';

const unit = (over: Partial<UnitInstance>): UnitInstance => ({
  id: over.id ?? 'u1',
  defID: over.defID ?? 'Spearman',
  cellKey: over.cellKey ?? '0,1',
  hp: over.hp ?? 1,
  placementOrder: over.placementOrder ?? 0,
  drillToken: over.drillToken,
  taughtSkills: over.taughtSkills,
});

const renderStack = (units: UnitInstance[]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <UnitStack units={units} />
    </ThemeProvider>,
  );

describe('UnitStack (defense redesign 3.2)', () => {
  it('renders nothing when the units list is empty', () => {
    const html = renderStack([]);
    expect(html).toBe('');
  });

  it('renders 3 stacked units with the earliest-placed unit at the bottom (DOM-first)', () => {
    const units: UnitInstance[] = [
      // Intentionally out of order so we know the component re-sorts.
      unit({ id: 'late', defID: 'Archer', placementOrder: 5 }),
      unit({ id: 'early', defID: 'Spearman', placementOrder: 1 }),
      unit({ id: 'mid', defID: 'Watchman', placementOrder: 3 }),
    ];
    const html = renderStack(units);
    // Each unit chip carries data-unit-id; pull them out in DOM order.
    const ids: string[] = [];
    const re = /data-unit-id="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      ids.push(m[1]!);
    }
    // DOM order must be earliest-first (sorted ascending by
    // placementOrder). column-reverse then places the earliest at
    // the visual bottom.
    expect(ids).toEqual(['early', 'mid', 'late']);
    // Stack metadata is exposed for debugging / further tests.
    expect(html).toContain('data-unit-stack="true"');
    expect(html).toContain('data-unit-count="3"');
    // No overflow badge for a 3-unit stack at the default visibleLimit.
    expect(html).not.toMatch(/data-unit-stack-overflow/);
  });

  it('caps the rendered stack and surfaces a "+N more" badge when units > 3', () => {
    const units: UnitInstance[] = [
      unit({ id: 'a', defID: 'Spearman', placementOrder: 1 }),
      unit({ id: 'b', defID: 'Archer', placementOrder: 2 }),
      unit({ id: 'c', defID: 'Watchman', placementOrder: 3 }),
      unit({ id: 'd', defID: 'Engineer', placementOrder: 4 }),
      unit({ id: 'e', defID: 'Sapper', placementOrder: 5 }),
    ];
    const html = renderStack(units);
    // visibleLimit defaults to 3; the badge takes one of those slots,
    // so two newest units render explicitly (placementOrder 4, 5).
    expect(html).toContain('data-unit-stack-overflow="3"');
    expect(html).toContain('+3 more');
    // The two newest IDs are still in the DOM as full chips.
    expect(html).toMatch(/data-unit-id="d"/);
    expect(html).toMatch(/data-unit-id="e"/);
    // The hidden ones (a, b, c) do NOT render as full chips — only the
    // overflow badge.
    expect(html).not.toMatch(/data-unit-id="a"/);
  });

  it('surfaces drill / teach indicators on the unit chip', () => {
    const html = renderStack([
      unit({
        id: 'u1',
        defID: 'Spearman',
        placementOrder: 1,
        drillToken: true,
        taughtSkills: ['extendRange'],
      }),
    ]);
    expect(html).toContain('data-drill="true"');
    expect(html).toContain('data-taught-count="1"');
  });
});
