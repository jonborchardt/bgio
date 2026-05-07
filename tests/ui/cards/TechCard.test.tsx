// TechCard render tests — verify the v9 by-role layout renders all four
// per-role panels (Chief / Science / Domestic / Foreign), each with the
// lines that role receives (buildings / units / resources). The
// `holderRole` prop no longer drives a "For you" highlight — every role
// panel is shown at detailed/page sizes.
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

const render = (
  def: TechnologyDef,
  holderRole?: 'chief' | 'science' | 'domestic' | 'defense',
): string =>
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

  it('omits the order line (cost+unlocks already convey the info)', () => {
    expect(render(fullTech)).not.toContain('after Foo + Bar');
  });

  it('renders coloured cost tokens (no duplicate cost text)', () => {
    const html = render(fullTech);
    // When costBag is rendered as tokens, the redundant `cost` string is
    // suppressed so the same cost doesn't appear twice on the card.
    expect(html).not.toContain('3 wood + 1 gold');
    // ResourceToken renders title="<count> <Resource>" (title-cased
    // resource name) — defense-redesign 3.9 polish: aligned with the
    // canonical token markup used everywhere else.
    expect(html).toContain('title="3 Wood"');
    expect(html).toContain('title="1 Gold"');
  });

  it('renders all four per-role panels with their lines populated', () => {
    const html = render(fullTech);
    // One panel header per role.
    expect(html).toContain('Chief');
    expect(html).toContain('Science');
    expect(html).toContain('Domestic');
    expect(html).toContain('Defense');
    // Buildings + Units appear under their owning role panels. Each
    // listed building/unit renders as its own chip (with a `?` button
    // when a CardInfoProvider is mounted), so we assert each name
    // independently rather than the legacy comma-joined string.
    expect(html).toContain('Buildings');
    expect(html).toContain('Granary');
    expect(html).toContain('Mill');
    expect(html).toContain('Units');
    expect(html).toContain('Spearman');
    // Every role's event line appears under its panel.
    expect(html).toContain('BLUE-EVENT-LINE');
    expect(html).toContain('GREEN-EVENT-LINE');
    expect(html).toContain('RED-EVENT-LINE');
    expect(html).toContain('GOLD-EVENT-LINE');
  });

  it('does not call out a "For you" block (v9 dropped that pattern)', () => {
    expect(render(fullTech, 'chief')).not.toContain('For you');
    expect(render(fullTech)).not.toContain('For you');
  });

  it('does not render empty role lines for a sparse tech', () => {
    const html = render(sparseTech, 'science');
    expect(html).toContain('Sparse Tech');
    expect(html).toContain('Education');
    // No buildings / units / resources lines — every event field is
    // empty, so each role panel collapses to nothing.
    expect(html).not.toContain('Buildings');
    expect(html).not.toContain('Units');
    expect(html).not.toContain('Resources');
    expect(html).not.toContain('For you');
  });
});
