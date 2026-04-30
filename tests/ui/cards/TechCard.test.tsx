// TechCard render tests — verify the rewritten card surfaces every
// populated TechnologyDef field, and only highlights the per-color event
// line that matches `holderRole`.
//
// `@testing-library/react` is not installed in this repo, so we use
// `react-dom/server`'s `renderToStaticMarkup` and assert against the HTML
// string. Wrapping in `ThemeProvider` keeps the MUI sx-callbacks happy.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { TechCard } from '../../../src/ui/cards/TechCard.tsx';
import type { TechnologyDef } from '../../../src/data/schema.ts';

const fullTech: TechnologyDef = {
  branch: 'Civic',
  name: 'Test Tech',
  order: 'after Foo + Bar',
  cost: '3 wood + 1 gold',
  buildings: 'Granary, Mill',
  units: 'Spearman',
  blueEvent: 'BLUE-EVENT-LINE',
  greenEvent: 'GREEN-EVENT-LINE',
  redEvent: 'RED-EVENT-LINE',
  goldEvent: 'GOLD-EVENT-LINE',
  costBag: { wood: 3, gold: 1 },
  onAcquireEffects: [{ kind: 'gainResource', resource: 'gold', amount: 2 }],
  onPlayEffects: [{ kind: 'tributeWaiver' }],
  passiveEffects: [{ kind: 'unitCost', delta: -1 }],
};

const sparseTech: TechnologyDef = {
  branch: 'Education',
  name: 'Sparse Tech',
  order: '',
  cost: '',
  buildings: '',
  units: '',
  blueEvent: '',
  greenEvent: '',
  redEvent: '',
  goldEvent: '',
};

const render = (def: TechnologyDef, holderRole?: 'chief' | 'science' | 'domestic' | 'foreign'): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <TechCard def={def} holderRole={holderRole} />
    </ThemeProvider>,
  );

describe('TechCard', () => {
  it('renders the tech name and branch', () => {
    const html = render(fullTech);
    expect(html).toContain('Test Tech');
    expect(html).toContain('Civic');
  });

  it('renders the order line when present', () => {
    expect(render(fullTech)).toContain('after Foo + Bar');
  });

  it('renders the cost text and costBag chips when present', () => {
    const html = render(fullTech);
    expect(html).toContain('3 wood + 1 gold');
    // ResourceChip renders aria-label="<resource> <count>"
    expect(html).toContain('aria-label="wood 3"');
    expect(html).toContain('aria-label="gold 1"');
  });

  it('renders the unlocks block (buildings + units) when populated', () => {
    const html = render(fullTech);
    expect(html).toContain('Unlocks');
    expect(html).toContain('Granary, Mill');
    expect(html).toContain('Spearman');
  });

  it('highlights only the holder role event line as "For you"', () => {
    const html = render(fullTech, 'chief');
    // Chief → gold; the "For you" header must mention Chief.
    expect(html).toMatch(/For you[^<]*Chief/);
    // Highlighted text is the goldEvent string.
    expect(html).toContain('GOLD-EVENT-LINE');
    // The other three event strings still appear (as muted context lines)
    // but only one "For you" header is rendered.
    expect((html.match(/For you/g) ?? []).length).toBe(1);
    expect(html).toContain('BLUE-EVENT-LINE');
    expect(html).toContain('GREEN-EVENT-LINE');
    expect(html).toContain('RED-EVENT-LINE');
  });

  it('omits the "For you" block when holderRole is not provided', () => {
    const html = render(fullTech);
    expect(html).not.toContain('For you');
    // All four lines should still be visible in the muted "other colors" list.
    expect(html).toContain('BLUE-EVENT-LINE');
    expect(html).toContain('GREEN-EVENT-LINE');
    expect(html).toContain('RED-EVENT-LINE');
    expect(html).toContain('GOLD-EVENT-LINE');
  });

  it('renders effect badges only for populated typed-effect arrays', () => {
    const html = render(fullTech);
    expect(html).toContain('Auto');
    expect(html).toContain('Play');
    expect(html).toContain('Passive');
  });

  it('does not render empty rows for a sparse tech', () => {
    const html = render(sparseTech, 'science');
    expect(html).toContain('Sparse Tech');
    expect(html).toContain('Education');
    expect(html).not.toContain('Unlocks');
    expect(html).not.toContain('Order:');
    expect(html).not.toContain('For you');
    // No effect badges — none of the typed-effect arrays are populated.
    expect(html).not.toContain('Auto');
    expect(html).not.toContain('Play');
    expect(html).not.toContain('Passive');
  });

  it('domestic holder highlights the green event line', () => {
    const html = render(fullTech, 'domestic');
    expect(html).toMatch(/For you[^<]*Domestic/);
  });

  it('foreign holder highlights the red event line', () => {
    const html = render(fullTech, 'foreign');
    expect(html).toMatch(/For you[^<]*Foreign/);
  });

  it('science holder highlights the blue event line', () => {
    const html = render(fullTech, 'science');
    expect(html).toMatch(/For you[^<]*Science/);
  });
});
