// 14.5 — GameOverBanner smoke tests. RTL not installed; render-and-
// click checks live as it.todo.

import { describe, expect, it } from 'vitest';

describe('GameOverBanner smoke (14.5)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/GameOverBanner.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.GameOverBanner).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('win outcome renders chief-gold accent + "You won!"');
  it.todo('timeUp outcome renders muted accent + "Time\'s up"');
  it.todo('Play again click invokes onPlayAgain');
});
