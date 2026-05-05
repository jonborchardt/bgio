// ChiefPanel smoke tests. The chief panel's flip / end-turn slot is
// now a unified <ChiefActionButton> — see tests/ui/chief/ChiefActionButton.test.tsx
// for its own render assertions.

import { describe, expect, it } from 'vitest';

describe('ChiefPanel smoke', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/ChiefPanel.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChiefPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('CircleEditor imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/CircleEditor.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.CircleEditor).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('ChiefActionButton imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chief/ChiefActionButton.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChiefActionButton).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('renders without crashing for numPlayers ∈ {1, 2, 4}');
  it.todo('clicking "End my turn" calls chiefEndPhase');
  it.todo("clicking '+1 gold' on seat 1 calls chiefDistribute('1', { gold: 1 })");
});
