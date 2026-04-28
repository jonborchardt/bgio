// 09.5 — DeckStack smoke tests. RTL is not installed yet, so the
// render-and-assert checks live as it.todo placeholders.

import { describe, expect, it } from 'vitest';

describe('DeckStack smoke (09.5)', () => {
  it('DeckStack imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/deck/DeckStack.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.DeckStack).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('DeckStack shows count = cards.length');
  it.todo('DeckStack with all null shows face-down only');
  it.todo('DeckStack with revealed top renders renderTop output');
  it.todo('clicking the stack fires onClick');
});
