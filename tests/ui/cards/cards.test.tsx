// 09.2 — Card components smoke tests.
//
// `@testing-library/react` is not installed in this repo (see package.json),
// so the rich render-and-assert checks sketched in 09.2's plan are gated
// behind it.todo placeholders. The smoke tests below verify each module
// imports + exports a callable component without runtime errors.

import { describe, expect, it } from 'vitest';

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

  it('ScienceCard (presentational, 09.2) imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/cards/ScienceCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ScienceCard).toBe('function');
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

  // TODO(09.2): once @testing-library/react is added, replace the smoke
  // tests above with the render-and-assert checks listed in the plan.
  it.todo('BuildingCard renders def.name, def.cost, def.benefit verbatim');
  it.todo('UnitCard count={3} shows "×3"');
  it.todo('EventCard faceDown does NOT render the card name');
  it.todo('snapshots: one of each card type');
});
