// 09.3 — CenterMat / Circle / TradeRequestSlot smoke tests. RTL is not
// installed yet, so render-and-assert checks live as it.todo placeholders.

import { describe, expect, it } from 'vitest';

describe('CenterMat smoke (09.3)', () => {
  it('Circle imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/mat/Circle.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Circle).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('TradeRequestSlot imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/mat/TradeRequestSlot.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.TradeRequestSlot).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('CenterMat imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/mat/CenterMat.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CenterMat).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('clicking your own circle fires pullFromMat with the current bag');
  it.todo('TradeRequestSlot renders nothing when tradeRequest is null');
});
