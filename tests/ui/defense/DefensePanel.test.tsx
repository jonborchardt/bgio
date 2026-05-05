// Defense redesign 3.6 — DefensePanel + sub-component smoke tests.
//
// Mirrors the Domestic / Science panel test pattern: smoke-import each
// module so a future rename / file-deletion fails loudly here. The
// rich render-and-click assertions belong on the per-component test
// files alongside (UnitHand / TechRow / InPlayList). Post-3.9
// preference sweep: PlacementOverlay was retired — placement now
// happens by clicking the BuildingGrid directly, so the defense panel
// no longer ships its own picker component.

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
