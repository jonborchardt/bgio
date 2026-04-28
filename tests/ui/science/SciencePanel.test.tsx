// 05.5 — SciencePanel smoke tests.
//
// `@testing-library/react` is not installed in this repo (see package.json),
// so the rich render-and-click assertions sketched in 05.5's plan are gated
// behind a TODO and only the import-without-crashing smoke check actually
// runs. When RTL is added later, replace the TODOs below with real tests.

import { describe, expect, it } from 'vitest';

describe('SciencePanel smoke (05.5)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/SciencePanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.SciencePanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('ScienceCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/ScienceCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ScienceCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('UnderCardsPopover imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/science/UnderCardsPopover.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.UnderCardsPopover).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  // TODO(05.5): once @testing-library/react is added, replace the smoke
  // tests above with the render-and-click checks listed in the plan.
  it.todo('renders the 3×3 grid for a fresh game');
  it.todo("clicking '+1 gold' fires scienceContribute(id, { gold: 1 })");
  it.todo('Complete is disabled until paid >= cost');
  it.todo('higher-level cards in an unfinished column are dimmed');
});
