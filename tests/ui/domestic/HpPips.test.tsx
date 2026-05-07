// Defense redesign 3.2 — HpPips render tests.
//
// Mirrors the existing UI test pattern in this repo: render via
// `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the resulting HTML string.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { HpPips } from '../../../src/ui/domestic/HpPips.tsx';

const renderPips = (current: number, max: number): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <HpPips current={current} max={max} />
    </ThemeProvider>,
  );

const countPips = (html: string, kind: 'filled' | 'empty'): number => {
  const re = new RegExp(`data-hp-pip="${kind}"`, 'g');
  return (html.match(re) ?? []).length;
};

describe('HpPips (defense redesign 3.2)', () => {
  it('full HP renders all pips filled and the "healthy" state', () => {
    const html = renderPips(4, 4);
    expect(countPips(html, 'filled')).toBe(4);
    expect(countPips(html, 'empty')).toBe(0);
    expect(html).toContain('data-hp-state="healthy"');
    expect(html).toContain('data-hp-current="4"');
    expect(html).toContain('data-hp-max="4"');
    // Defense-redesign 3.9 polish: aria-label includes the named state
    // ("healthy" / "warning" / "critical") so screen-reader users can
    // hear the building's condition without inferring from the count.
    expect(html).toContain('aria-label="HP 4 of 4, healthy"');
  });

  it('half HP renders 2 filled / 2 empty pips with "warning" state', () => {
    const html = renderPips(2, 4);
    expect(countPips(html, 'filled')).toBe(2);
    expect(countPips(html, 'empty')).toBe(2);
    expect(html).toContain('data-hp-state="warning"');
  });

  it('1 HP renders the critical state', () => {
    const html = renderPips(1, 4);
    expect(countPips(html, 'filled')).toBe(1);
    expect(countPips(html, 'empty')).toBe(3);
    expect(html).toContain('data-hp-state="critical"');
  });

  it('clamps maxHp into [1, 4] for defensive rendering', () => {
    // maxHp = 6 collapses to 4 so the row never wraps the tile header.
    const html = renderPips(3, 6);
    expect(countPips(html, 'filled') + countPips(html, 'empty')).toBe(4);
    expect(html).toContain('data-hp-max="4"');
  });

  it('clamps current into [0, max] for defensive rendering', () => {
    // current > max collapses to max.
    const html = renderPips(7, 3);
    expect(countPips(html, 'filled')).toBe(3);
    expect(countPips(html, 'empty')).toBe(0);
    expect(html).toContain('data-hp-state="healthy"');
  });

  // Defense-redesign 3.9 polish — color-blind safe shape variants.
  // Each pip carries a `data-hp-pip-shape` attribute matching the
  // visual mark drawn on top of the colored fill, so non-color-driven
  // a11y testing can assert on the shape rather than the hue.
  describe('color-blind safe pip shapes (3.9)', () => {
    it('healthy pips carry shape="healthy"', () => {
      const html = renderPips(4, 4);
      // All four filled pips read as healthy (full HP).
      expect((html.match(/data-hp-pip-shape="healthy"/g) ?? []).length).toBe(4);
      // No warning / critical shape on a fully-healed building.
      expect(html).not.toContain('data-hp-pip-shape="warning"');
      expect(html).not.toContain('data-hp-pip-shape="critical"');
    });

    it('warning state filled pips carry shape="warning"', () => {
      // 2/4 hp = warning state. Empty pips remain shape="empty".
      const html = renderPips(2, 4);
      expect((html.match(/data-hp-pip-shape="warning"/g) ?? []).length).toBe(2);
      expect((html.match(/data-hp-pip-shape="empty"/g) ?? []).length).toBe(2);
    });

    it('critical state filled pips carry shape="critical"', () => {
      // hp = 1 → critical state.
      const html = renderPips(1, 4);
      expect((html.match(/data-hp-pip-shape="critical"/g) ?? []).length).toBe(1);
      expect((html.match(/data-hp-pip-shape="empty"/g) ?? []).length).toBe(3);
    });
  });
});
