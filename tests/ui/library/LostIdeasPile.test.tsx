// Sub-plan 5.3 — LostIdeasPile render tests.
//
// Static-markup smokes: the empty state renders the placeholder, and a
// non-empty pile surfaces the topmost burned card's name + a count
// badge. The dialog itself is closed in the static render (Material's
// Dialog only mounts when `open`), so we assert the trigger button's
// aria-label includes the count, which is the contract callers care
// about.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { LostIdeasPile } from '../../../src/ui/library/LostIdeasPile.tsx';
import type { LibraryCard } from '../../../src/game/library/types.ts';
import type {
  BuildingDef,
  UnitDef,
  TechnologyDef,
} from '../../../src/data/schema.ts';

const buildingCard = (
  name: string,
  tier: 1 | 2 | 3,
  scienceColor: 'gold' | 'blue' | 'green' | 'red',
): LibraryCard => ({
  kind: 'building',
  tier,
  scienceColor,
  // Only `def.name` is read by the component; the rest is structural
  // padding so the strict type still admits the fixture.
  def: {
    name,
    cost: 1,
    benefit: '',
    note: '',
    maxHp: 1,
    tier,
    scienceColor,
  } as BuildingDef,
});

const unitCard = (
  name: string,
  tier: 1 | 2 | 3,
  scienceColor: 'gold' | 'blue' | 'green' | 'red',
): LibraryCard => ({
  kind: 'unit',
  tier,
  scienceColor,
  def: {
    name,
    cost: 1,
    initiative: 1,
    attack: 1,
    hp: 1,
    altStats: '',
    requires: '',
    note: '',
    range: 1,
    regen: 0,
    firstStrike: false,
    placementBonus: [],
    tier,
    scienceColor,
  } as UnitDef,
});

const techCard = (
  name: string,
  tier: 1 | 2 | 3,
  scienceColor: 'gold' | 'blue' | 'green' | 'red',
): LibraryCard => ({
  kind: 'tech',
  tier,
  scienceColor,
  def: {
    branch: '',
    name,
    order: '',
    cost: '',
    buildings: '',
    units: '',
    blueEvent: '',
    greenEvent: '',
    redEvent: '',
    goldEvent: '',
    tier,
    scienceColor,
  } as TechnologyDef,
});

const renderPile = (lostIdeas: ReadonlyArray<LibraryCard>): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <LostIdeasPile lostIdeas={lostIdeas} />
    </ThemeProvider>,
  );

describe('LostIdeasPile (sub-plan 5.3)', () => {
  it('renders the faint "no ideas lost" placeholder when empty', () => {
    const html = renderPile([]);
    expect(html).toContain('data-testid="lost-ideas-pile"');
    expect(html).toContain('data-count="0"');
    expect(html).toContain('no ideas lost');
    // Empty state should NOT mount a clickable trigger or count badge.
    expect(html).not.toContain('data-testid="lost-ideas-count"');
    expect(html).not.toContain('aria-label="View the');
  });

  it('renders the most-recently-burned topcard name and a count badge', () => {
    const cards: LibraryCard[] = [
      buildingCard('Granary', 1, 'green'),
      unitCard('Scout', 1, 'red'),
      techCard('Cartography', 2, 'blue'),
    ];
    const html = renderPile(cards);

    expect(html).toContain('data-testid="lost-ideas-pile"');
    expect(html).toContain('data-count="3"');

    // Topcard = freshest burn = last entry.
    expect(html).toContain('Cartography');

    // Count badge is mounted with its own testid + the numeric count.
    expect(html).toContain('data-testid="lost-ideas-count"');
    expect(html).toMatch(/data-testid="lost-ideas-count"[^>]*>\s*3/);

    // A11y trigger label includes the count and the required wording.
    expect(html).toContain(
      'aria-label="View the 3 cards the village never discovered."',
    );
  });

  it('uses singular-friendly count in the aria-label even at one card', () => {
    const html = renderPile([buildingCard('Granary', 1, 'green')]);
    expect(html).toContain(
      'aria-label="View the 1 cards the village never discovered."',
    );
    expect(html).toContain('Granary');
  });
});
