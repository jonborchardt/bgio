// 07.7 — ForeignPanel smoke tests.
//
// `@testing-library/react` is not installed in this repo (see package.json),
// so the rich render-and-click assertions sketched in 07.7's plan are gated
// behind a TODO and only the import-without-crashing smoke check actually
// runs. When RTL is added later, replace the TODOs below with real tests.

import { describe, expect, it } from 'vitest';

describe('ForeignPanel smoke (07.7)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/foreign/ForeignPanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ForeignPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('Army imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/foreign/Army.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Army).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('Decks imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/foreign/Decks.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Decks).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('BattlePanel imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/foreign/BattlePanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.BattlePanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('AssignDamageDialog imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/foreign/AssignDamageDialog.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.AssignDamageDialog).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  // TODO(07.7): once @testing-library/react is added, replace the smoke
  // tests above with the render-and-click checks listed in the plan.
  it.todo('recruit click fires foreignRecruit with correct args');
  it.todo('Flip Battle disables during in-flight');
  it.todo('Assign-damage dialog refuses submission if any round under-allocates');
});
