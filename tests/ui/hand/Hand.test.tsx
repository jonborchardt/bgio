// 09.5 — Hand smoke tests (generic Hand at src/ui/hand/Hand.tsx, NOT the
// domestic-specific src/ui/domestic/Hand.tsx). RTL is not installed yet, so
// the render-and-assert checks live as it.todo placeholders.

import { describe, expect, it } from 'vitest';

describe('Hand smoke (09.5)', () => {
  it('generic Hand imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/hand/Hand.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.Hand).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('selected card has higher z-index / elevation');
  it.todo('clicking a card fires onSelect with the card');
});
