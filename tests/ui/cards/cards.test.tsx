// 09.2 — Card components smoke + RTL render checks. Issue 029
// closed the it.todos here once @testing-library/react landed.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { BuildingCard } from '../../../src/ui/cards/BuildingCard.tsx';
import { UnitCard } from '../../../src/ui/cards/UnitCard.tsx';
import { EventCard } from '../../../src/ui/cards/EventCard.tsx';
import { BUILDINGS, UNITS, EVENT_CARDS } from '../../../src/data/index.ts';
import { CardInfoProvider } from '../../../src/ui/cards/CardInfoContext.tsx';

const wrap = (ui: React.ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <CardInfoProvider>{ui}</CardInfoProvider>
    </ThemeProvider>,
  );

describe('Card components smoke (09.2)', () => {
  it('CardFrame imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/CardFrame.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CardFrame).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('BuildingCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/BuildingCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.BuildingCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('UnitCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/UnitCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.UnitCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('TechCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/TechCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.TechCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('EventCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/EventCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.EventCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('BuildingCard renders def.name verbatim', () => {
    const def = BUILDINGS[0]!;
    wrap(<BuildingCard def={def} />);
    // The name appears in the card shell. Use a relaxed text matcher
    // since V9CardShell may wrap it in additional spans.
    expect(screen.getAllByText(new RegExp(def.name)).length).toBeGreaterThan(0);
  });

  it('UnitCard count={3} renders an "×3" multiplier', () => {
    const def = UNITS[0]!;
    wrap(<UnitCard def={def} count={3} />);
    // The shell may surface the count multiplier in more than one slot
    // (badge + headline). We only need at least one.
    expect(screen.getAllByText(/×\s*3/).length).toBeGreaterThan(0);
  });

  it('EventCard faceDown=true does NOT render the card name', () => {
    const def = EVENT_CARDS[0]!;
    wrap(<EventCard def={def} faceDown />);
    expect(screen.queryByText(def.name)).toBeNull();
    // The face-down placeholder carries an aria-label for screen readers.
    expect(screen.getByLabelText('Face-down event card')).toBeTruthy();
  });

  it('EventCard face-up DOES render the card name', () => {
    const def = EVENT_CARDS[0]!;
    wrap(<EventCard def={def} />);
    expect(screen.getAllByText(new RegExp(def.name)).length).toBeGreaterThan(0);
  });
});
