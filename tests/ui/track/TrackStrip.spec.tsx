// Defense redesign 3.1 — TrackStrip render tests.
//
// Mirrors the existing UI test pattern in this repo: render via
// `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the resulting HTML string.
// `@testing-library/react` is not installed.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { TrackStrip } from '../../../src/ui/track/TrackStrip.tsx';
import type {
  TrackCardDef,
  ThreatCard,
  BoonCard,
  ModifierCard,
  BossCard,
} from '../../../src/data/schema.ts';

const threat = (overrides: Partial<ThreatCard> = {}): ThreatCard => ({
  kind: 'threat',
  id: overrides.id ?? 'threat-1',
  name: overrides.name ?? 'Cavalry Raid',
  phase: overrides.phase ?? 1,
  description: overrides.description ?? 'A small cavalry skirmish.',
  direction: overrides.direction ?? 'N',
  offset: overrides.offset ?? 0,
  strength: overrides.strength ?? 3,
  ...overrides,
});

const boon = (overrides: Partial<BoonCard> = {}): BoonCard => ({
  kind: 'boon',
  id: overrides.id ?? 'boon-1',
  name: overrides.name ?? 'Wandering Trader',
  phase: overrides.phase ?? 2,
  description: overrides.description ?? '+3 wood to bank.',
  effect: overrides.effect ?? { kind: 'gainResource', resource: 'wood', amount: 3 },
});

const modifier = (overrides: Partial<ModifierCard> = {}): ModifierCard => ({
  kind: 'modifier',
  id: overrides.id ?? 'mod-1',
  name: overrides.name ?? 'Sandstorm',
  phase: overrides.phase ?? 3,
  description: overrides.description ?? 'Range reduced by 1 this round.',
  durationRounds: overrides.durationRounds ?? 1,
  effect: overrides.effect ?? { kind: 'modifier-stub' },
});

const boss = (overrides: Partial<BossCard> = {}): BossCard => ({
  kind: 'boss',
  id: overrides.id ?? 'boss',
  name: overrides.name ?? 'The Last Settlement',
  phase: 10,
  description: overrides.description ?? 'Final boss.',
  baseAttacks: overrides.baseAttacks ?? 4,
  thresholds: overrides.thresholds ?? { science: 6, economy: 12, military: 8 },
  attackPattern: overrides.attackPattern ?? [
    { direction: 'N', offset: 0, strength: 3 },
  ],
});

const renderStrip = (props: Parameters<typeof TrackStrip>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <TrackStrip {...props} />
    </ThemeProvider>,
  );

describe('TrackStrip (3.1)', () => {
  it('renders an empty-state strip when there is no history / current / next / upcoming', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: undefined,
      upcomingCount: 0,
      phase: 1,
    });
    // All ten phase markers render regardless of game state.
    for (let p = 1; p <= 10; p += 1) {
      const aria = p === 10 ? 'Boss phase marker' : `Phase ${p} marker`;
      expect(html).toContain(`aria-label="${aria}"`);
    }
    // Empty hint visible.
    expect(html).toContain('Track empty');
  });

  it('marks the active phase via data-active="true"', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: threat({ phase: 4 }),
      upcomingCount: 0,
      phase: 4,
    });
    // Phase 4's marker has data-active="true"; phase 1's does not.
    expect(html).toMatch(/data-phase="4"[^>]*data-active="true"/);
    expect(html).toMatch(/data-phase="1"[^>]*data-active="false"/);
  });

  it('renders past, current, and next slots mid-game', () => {
    const past: TrackCardDef[] = [
      threat({ id: 'p1', name: 'Wolves', phase: 1 }),
      threat({ id: 'p2', name: 'Bandits', phase: 1, offset: 1 }),
      boon({ id: 'p3', name: 'Trader', phase: 2 }),
      threat({ id: 'p4', name: 'Skirmish', phase: 2, direction: 'E' }),
      modifier({ id: 'p5', name: 'Storm', phase: 3 }),
    ];
    const current = threat({ id: 'cur', name: 'Cavalry', phase: 4, strength: 6 });
    const nxt = threat({ id: 'nxt', name: 'Hounds', phase: 4, strength: 4 });
    const html = renderStrip({
      history: past,
      current,
      next: nxt,
      upcomingCount: 12,
      phase: 4,
    });
    // Current + next names show up.
    expect(html).toContain('Cavalry');
    expect(html).toContain('Hounds');
    // A few past names show up.
    expect(html).toContain('Wolves');
    expect(html).toContain('Trader');
    // Current card is keyed with state="current" and next with state="next".
    expect(html).toContain('data-track-card-state="current"');
    expect(html).toContain('data-track-card-state="next"');
    expect(html).toContain('data-track-card-state="past"');
    // Threat summary surfaces direction + offset + strength on the
    // telegraph card.
    expect(html).toContain('S4');
  });

  it('caps visible past cards and shows "+N earlier" overflow label', () => {
    const past: TrackCardDef[] = Array.from({ length: 9 }, (_, i) =>
      threat({ id: `p${i}`, name: `Past ${i}`, phase: 1 + Math.floor(i / 3) }),
    );
    const html = renderStrip({
      history: past,
      current: undefined,
      next: undefined,
      upcomingCount: 0,
      phase: 4,
    });
    // 9 past, cap = 6 → 3 truncated.
    expect(html).toContain('+3 earlier');
    // Latest past card name is preserved (oldest dropped).
    expect(html).toContain('Past 8');
  });

  it('renders boss readout with thresholds when current is the boss card', () => {
    const html = renderStrip({
      history: [],
      current: boss(),
      next: undefined,
      upcomingCount: 0,
      phase: 10,
    });
    expect(html).toContain('The Last Settlement');
    expect(html).toContain('data-track-card-kind="boss"');
    // Thresholds preview surfaces in the summary line.
    expect(html).toContain('Sci 6');
    expect(html).toContain('Eco 12');
    expect(html).toContain('Mil 8');
  });

  it('renders a face-down hint sized by upcomingCount', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: threat(),
      upcomingCount: 5,
      phase: 1,
    });
    expect(html).toContain('Face-down cards remaining: 5');
  });

  it('renders an "+N" overflow when upcomingCount exceeds the visible cap', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: threat(),
      upcomingCount: 20,
      phase: 1,
    });
    // 8 visible tiles + "+12" overflow.
    expect(html).toContain('+12');
  });
});
