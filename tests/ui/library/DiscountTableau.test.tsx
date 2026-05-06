// SL 5.2 — DiscountTableau render tests.
//
// Uses `renderToStaticMarkup` + `ThemeProvider` (the same pattern
// the TrackStrip tests use) since `@testing-library/react` is not
// installed in this repo.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { DiscountTableau } from '../../../src/ui/library/DiscountTableau.tsx';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  LibraryColor,
  LibraryTier,
} from '../../../src/data/schema.ts';

const fakeCard = (
  scienceColor: LibraryColor,
  tier: LibraryTier,
  id = `${scienceColor}-${tier}`,
): LibraryCard =>
  ({
    kind: 'building',
    tier,
    scienceColor,
    def: {
      name: id,
      cost: 0,
      benefit: '',
      note: '',
      maxHp: 1,
    },
  }) as LibraryCard;

const render = (props: Parameters<typeof DiscountTableau>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <DiscountTableau {...props} />
    </ThemeProvider>,
  );

describe('DiscountTableau', () => {
  it('renders the empty-state hint when no cards are tableau-d', () => {
    const html = render({ tableau: [], seat: '1' });
    expect(html).toContain('No bought cards yet');
    expect(html).toContain('hit the Library row above');
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('data-seat="1"');
  });

  it('groups three wood-discount cards into a single -3 row', () => {
    // Domestic T1 → -1 wood. Three of them stack to -3 wood.
    const tableau: LibraryCard[] = [
      fakeCard('green', 1, 'green-1-a'),
      fakeCard('green', 1, 'green-1-b'),
      fakeCard('green', 1, 'green-1-c'),
    ];
    const html = render({ tableau, seat: '1' });

    expect(html).not.toContain('No bought cards yet');
    expect(html).toContain('data-discount-row="wood"');
    expect(html).toContain('data-discount-total="3"');
    expect(html).toContain('data-discount-count="3"');
    expect(html).toContain('-3');
    expect(html).toContain('(3 cards)');

    // Single resource → exactly one row.
    const rowMatches = html.match(/data-discount-row="/g) ?? [];
    expect(rowMatches.length).toBe(1);
  });

  it('renders separate rows per discount resource for a mixed tableau', () => {
    // green T1 → -1 wood; red T1 → -1 stone; blue T1 → -1 science.
    const tableau: LibraryCard[] = [
      fakeCard('green', 1, 'green-1'),
      fakeCard('red', 1, 'red-1'),
      fakeCard('blue', 1, 'blue-1'),
    ];
    const html = render({ tableau, seat: '2' });

    expect(html).toContain('data-discount-row="wood"');
    expect(html).toContain('data-discount-row="stone"');
    expect(html).toContain('data-discount-row="science"');

    const rowMatches = html.match(/data-discount-row="/g) ?? [];
    expect(rowMatches.length).toBe(3);

    // Each resource sits at -1 with one card backing it.
    expect(html).toContain('(1 card)');
    expect(html).not.toContain('(1 cards)');

    // Canonical RESOURCES order — wood (index 2) comes before stone
    // (index 3) which comes before science (index 5). The substring
    // positions of each row marker must follow that ordering.
    const idxWood = html.indexOf('data-discount-row="wood"');
    const idxStone = html.indexOf('data-discount-row="stone"');
    const idxScience = html.indexOf('data-discount-row="science"');
    expect(idxWood).toBeLessThan(idxStone);
    expect(idxStone).toBeLessThan(idxScience);
  });
});
