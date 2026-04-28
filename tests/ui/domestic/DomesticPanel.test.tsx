// 06.7 — DomesticPanel smoke tests.
//
// `@testing-library/react` is not installed in this repo (see package.json),
// so the rich render-and-click assertions sketched in 06.7's plan are gated
// behind a TODO and only the import-without-crashing smoke check actually
// runs. When RTL is added later, replace the TODOs below with real tests.

import { describe, expect, it } from 'vitest';

describe('DomesticPanel smoke (06.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/DomesticPanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.DomesticPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('Hand imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/Hand.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Hand).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('CellSlot imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/CellSlot.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CellSlot).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('BuildingGrid imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/domestic/BuildingGrid.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.BuildingGrid).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  // TODO(06.7): once @testing-library/react is added, replace the smoke
  // tests above with the render-and-click checks listed in the plan.
  it.todo(
    'empty grid: clicking the center cell while a card is active fires domesticBuyBuilding',
  );
  it.todo('once a building exists, only neighbors highlight as legal');
  it.todo('"Produce" button disables after one click in a round');
});
