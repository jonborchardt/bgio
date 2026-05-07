// TrackStrip render tests — unified single-row timeline.

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
  thresholds: overrides.thresholds ?? { science: 6, economy: 12 },
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

describe('TrackStrip', () => {
  it('renders an empty-state hint when no slots exist', () => {
    const html = renderStrip({
      history: [],
      current: undefined,
      upcoming: [],
      phase: 1,
    });
    expect(html).toContain('Track empty');
  });

  it('renders past + current + face-down upcoming as a single row', () => {
    const past: TrackCardDef[] = [
      threat({ id: 'p1', name: 'Wolves', phase: 1 }),
      threat({ id: 'p2', name: 'Bandits', phase: 1, offset: 1 }),
      boon({ id: 'p3', name: 'Trader', phase: 2 }),
      threat({ id: 'p4', name: 'Skirmish', phase: 2, direction: 'E' }),
      modifier({ id: 'p5', name: 'Storm', phase: 3 }),
    ];
    const current = threat({ id: 'cur', name: 'Cavalry', phase: 4, strength: 6 });
    const upcoming: TrackCardDef[] = [
      threat({ id: 'u1', name: 'Hidden', phase: 4 }),
      threat({ id: 'u2', name: 'Hidden', phase: 5 }),
      boss(),
    ];
    const html = renderStrip({
      history: past,
      current,
      upcoming,
      phase: 4,
    });
    // Past + current names render face-up.
    expect(html).toContain('Wolves');
    expect(html).toContain('Cavalry');
    // Each face-up slot carries its slot state for tests.
    expect(html).toContain('data-slot-state="past"');
    expect(html).toContain('data-slot-state="current"');
    expect(html).toContain('data-slot-state="upcoming"');
    // Boss slot lights up at the tail.
    expect(html).toContain('data-slot-boss="true"');
    // Phase chips appear at phase boundaries (P1, P2, P3, P4 …).
    expect(html).toContain('>P1<');
    expect(html).toContain('>P2<');
    expect(html).toContain('>BOSS<');
  });

  it('renders the active phase chip as live', () => {
    const upcoming: TrackCardDef[] = [
      threat({ id: 'u1', phase: 1 }),
      threat({ id: 'u2', phase: 4 }),
      boss(),
    ];
    const html = renderStrip({
      history: [],
      current: undefined,
      upcoming,
      phase: 4,
    });
    expect(html).toMatch(/data-phase-chip="4"[^>]*data-phase-active="true"/);
    expect(html).toMatch(/data-phase-chip="1"[^>]*data-phase-active="false"/);
  });

  it('renders every past card without truncation', () => {
    const past: TrackCardDef[] = Array.from({ length: 9 }, (_, i) =>
      threat({ id: `p${i}`, name: `Past ${i}`, phase: 1 + Math.floor(i / 3) }),
    );
    const html = renderStrip({
      history: past,
      current: undefined,
      upcoming: [],
      phase: 4,
    });
    expect(html).not.toContain('earlier');
    expect(html).toContain('Past 0');
    expect(html).toContain('Past 8');
  });

  it('renders the boss card face-up when it sits in current', () => {
    const html = renderStrip({
      history: [],
      current: boss(),
      upcoming: [],
      phase: 10,
    });
    expect(html).toContain('The Last Settlement');
    expect(html).toContain('data-track-card-kind="boss"');
    expect(html).toContain('Sci 6');
    expect(html).toContain('Eco 12');
    expect(html).not.toContain('Mil ');
  });

  it('renders one face-down slot per upcoming card', () => {
    const upcoming: TrackCardDef[] = Array.from({ length: 20 }, (_, i) =>
      threat({ id: `u${i}`, phase: 1 + (i % 9) }),
    );
    upcoming.push(boss());
    const html = renderStrip({
      history: [],
      current: undefined,
      upcoming,
      phase: 1,
    });
    const upcomingTiles = (html.match(/data-slot-state="upcoming"/g) ?? [])
      .length;
    // 20 hidden + 1 boss = 21 face-down slots.
    expect(upcomingTiles).toBe(21);
    // No "+N" overflow.
    expect(html).not.toMatch(/\+\d+ /);
  });
});
