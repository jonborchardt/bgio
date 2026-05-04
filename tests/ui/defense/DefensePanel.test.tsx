// Defense redesign 3.6 — DefensePanel + sub-component smoke tests.
//
// Mirrors the Domestic / Science panel test pattern: smoke-import each
// module so a future rename / file-deletion fails loudly here. The
// rich render-and-click assertions belong on the per-component test
// files alongside (UnitHand / PlacementOverlay / TechRow / InPlayList).

import { describe, expect, it } from 'vitest';

describe('DefensePanel smoke (defense redesign 3.6)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/DefensePanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.DefensePanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('UnitCard imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/UnitCard.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.UnitCard).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('UnitHand imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/UnitHand.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.UnitHand).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('PlacementOverlay imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/PlacementOverlay.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.PlacementOverlay).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('TechRow imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/TechRow.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.TechRow).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('InPlayList imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/defense/InPlayList.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.InPlayList).toBe('function');
    expect(typeof mod.default).toBe('function');
  });
});
