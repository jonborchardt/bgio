// 09.3 — ResourceBag / ResourceChip smoke tests. RTL is not installed yet, so
// the rich render-and-assert checks live as it.todo placeholders.

import { describe, expect, it } from 'vitest';

describe('ResourceBag smoke (09.3)', () => {
  it('ResourceChip imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/resources/ResourceChip.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ResourceChip).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('ResourceBag imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/resources/ResourceBag.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ResourceBag).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('ResourceBag shows only non-zero resources by default');
  it.todo('ResourceBag hideZero={false} shows everything');
});
