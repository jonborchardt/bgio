// Defense redesign 3.5 — BossReadout render tests.
//
// Mirrors the existing UI test pattern in this repo (and TrackStrip's
// own spec): render via `react-dom/server`'s `renderToStaticMarkup`,
// wrap in MUI's ThemeProvider, and assert against the resulting HTML
// string. `@testing-library/react` is not installed.
//
// Coverage:
//   - All thresholds met → three ✓ rows + "Attacks remaining: ... = 1"
//     for the V1 boss (baseAttacks 4).
//   - Mixed → two ✓ + one ✗.
//   - None met → full base attacks remain.
//   - Boss not in next slot → not rendered (parent TrackStrip handles
//     this; spec'd as a TrackStrip-level assertion since the gating
//     decision lives there).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { BossReadout } from '../../../src/ui/track/BossReadout.tsx';
import { TrackStrip } from '../../../src/ui/track/TrackStrip.tsx';
import type {
  BossCard,
  ThreatCard,
} from '../../../src/data/schema.ts';

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

const threat = (overrides: Partial<ThreatCard> = {}): ThreatCard => ({
  kind: 'threat',
  id: overrides.id ?? 'threat-1',
  name: overrides.name ?? 'Cavalry Raid',
  phase: overrides.phase ?? 4,
  description: overrides.description ?? 'A small cavalry skirmish.',
  direction: overrides.direction ?? 'N',
  offset: overrides.offset ?? 0,
  strength: overrides.strength ?? 3,
  ...overrides,
});

const renderReadout = (props: Parameters<typeof BossReadout>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <BossReadout {...props} />
    </ThemeProvider>,
  );

const renderStrip = (props: Parameters<typeof TrackStrip>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <TrackStrip {...props} />
    </ThemeProvider>,
  );

describe('BossReadout (3.5)', () => {
  it('renders all three thresholds met → 1 attack remaining (4 - 3)', () => {
    const html = renderReadout({
      boss: boss(),
      current: { science: 6, economy: 12, military: 8 },
    });
    // Each row is keyed with data-met="true".
    expect(html).toMatch(/data-testid="boss-readout-row-sci"[^>]*data-met="true"/);
    expect(html).toMatch(/data-testid="boss-readout-row-eco"[^>]*data-met="true"/);
    expect(html).toMatch(/data-testid="boss-readout-row-mil"[^>]*data-met="true"/);
    // ARIA labels surface "met" for screen readers.
    expect(html).toContain('Science: 6 of 6 met');
    expect(html).toContain('Economy: 12 of 12 met');
    expect(html).toContain('Military: 8 of 8 met');
    // Attacks remaining: 4 - 3 = 1.
    expect(html).toContain('Attacks remaining: 4 − 3 = 1');
    // All-met recommendation text fires.
    expect(html).toContain('All thresholds met');
  });

  it('renders all three thresholds met above-required → still 3 met', () => {
    // Overshoot on every axis — still counts as met (>= comparison).
    const html = renderReadout({
      boss: boss(),
      current: { science: 9, economy: 100, military: 20 },
    });
    expect(html).toMatch(/data-testid="boss-readout-row-sci"[^>]*data-met="true"/);
    expect(html).toMatch(/data-testid="boss-readout-row-eco"[^>]*data-met="true"/);
    expect(html).toMatch(/data-testid="boss-readout-row-mil"[^>]*data-met="true"/);
    expect(html).toContain('Attacks remaining: 4 − 3 = 1');
  });

  it('renders mixed met (2 met, 1 unmet) with 2 attacks remaining', () => {
    const html = renderReadout({
      boss: boss(),
      // Science met (6 ≥ 6), Economy unmet (5 < 12), Military met (8 ≥ 8).
      current: { science: 6, economy: 5, military: 8 },
    });
    expect(html).toMatch(/data-testid="boss-readout-row-sci"[^>]*data-met="true"/);
    expect(html).toMatch(/data-testid="boss-readout-row-eco"[^>]*data-met="false"/);
    expect(html).toMatch(/data-testid="boss-readout-row-mil"[^>]*data-met="true"/);
    // ARIA labels: economy reads "not met".
    expect(html).toContain('Economy: 5 of 12 not met');
    // Attacks remaining: 4 - 2 = 2.
    expect(html).toContain('Attacks remaining: 4 − 2 = 2');
    // Recommendation suggests dropping to 1.
    expect(html).toContain('drop to 1 attack');
  });

  it('renders zero met → full base attacks (4) remaining', () => {
    const html = renderReadout({
      boss: boss(),
      current: { science: 0, economy: 0, military: 0 },
    });
    expect(html).toMatch(/data-testid="boss-readout-row-sci"[^>]*data-met="false"/);
    expect(html).toMatch(/data-testid="boss-readout-row-eco"[^>]*data-met="false"/);
    expect(html).toMatch(/data-testid="boss-readout-row-mil"[^>]*data-met="false"/);
    // Attacks remaining: 4 - 0 = 4.
    expect(html).toContain('Attacks remaining: 4 − 0 = 4');
    // Recommendation suggests dropping to 3 next.
    expect(html).toContain('drop to 3 attacks');
  });

  it('clamps attacks remaining to 0 when the village over-prepares against a soft boss', () => {
    // Hypothetical small boss with baseAttacks 2 and only 2 thresholds met
    // — clamp at 0 even though `baseAttacks - met` would be -1 ish if the
    // boss had baseAttacks 1. Use baseAttacks 1 + all 3 met to exercise
    // the `Math.max(0, ...)` clamp explicitly.
    const html = renderReadout({
      boss: boss({ baseAttacks: 1 }),
      current: { science: 6, economy: 12, military: 8 },
    });
    expect(html).toContain('Attacks remaining: 1 − 3 = 0');
  });

  it('shows the boss name in the readout heading', () => {
    const html = renderReadout({
      boss: boss({ name: 'The Sky Devourer' }),
      current: { science: 0, economy: 0, military: 0 },
    });
    expect(html).toContain('The Sky Devourer');
  });
});

describe('TrackStrip → BossReadout integration (3.5)', () => {
  it('renders the boss readout when next-card is the boss and totals are supplied', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: boss(),
      upcomingCount: 0,
      phase: 9,
      villageTotals: { science: 6, economy: 5, military: 8 },
    });
    expect(html).toContain('data-testid="boss-readout"');
    // Sanity: the row data leaks through the strip wrapper.
    expect(html).toMatch(/data-testid="boss-readout-row-eco"[^>]*data-met="false"/);
  });

  it('does NOT render the boss readout when next-card is a regular threat', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: threat(),
      upcomingCount: 0,
      phase: 4,
      villageTotals: { science: 0, economy: 0, military: 0 },
    });
    expect(html).not.toContain('data-testid="boss-readout"');
  });

  it('does NOT render the boss readout when next-card is undefined (track exhausted before boss)', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      next: undefined,
      upcomingCount: 0,
      phase: 10,
      villageTotals: { science: 6, economy: 12, military: 8 },
    });
    expect(html).not.toContain('data-testid="boss-readout"');
  });

  it('does NOT render the boss readout when villageTotals is omitted, even with boss next', () => {
    // Defensive: the strip is still mountable from older call sites
    // that haven't wired `villageTotals` yet (e.g. headless test harnesses
    // mocking partial board state). It silently skips the readout
    // rather than rendering with stale zeros.
    const html = renderStrip({
      history: [],
      current: undefined,
      next: boss(),
      upcomingCount: 0,
      phase: 9,
    });
    expect(html).not.toContain('data-testid="boss-readout"');
  });

  it('does NOT render the boss readout when boss is the CURRENT card (already flipped)', () => {
    // §10.6 + the plan are explicit: the readout is for the *next*
    // (telegraphed) slot. Once the boss has flipped into "current,"
    // the village's prep window has closed and `resolveBoss` has
    // already counted thresholds.
    const html = renderStrip({
      history: [],
      current: boss(),
      next: undefined,
      upcomingCount: 0,
      phase: 10,
      villageTotals: { science: 6, economy: 12, military: 8 },
    });
    expect(html).not.toContain('data-testid="boss-readout"');
  });
});
