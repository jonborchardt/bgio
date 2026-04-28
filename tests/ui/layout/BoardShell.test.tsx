// 09.1 — BoardShell / RoleSlot / StatusBar smoke tests. RTL is not installed
// yet, so render-and-assert checks live as it.todo placeholders.

import { describe, expect, it } from 'vitest';

describe('Layout shell smoke (09.1)', () => {
  it('BoardShell imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/BoardShell.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.BoardShell).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('RoleSlot imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/RoleSlot.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.RoleSlot).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('StatusBar imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/StatusBar.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.StatusBar).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('4-player game with local seat=Foreign expands only Foreign slot');
  it.todo('1-player game expands every slot');
  it.todo('StatusBar shows the right phase / player / round on a fresh game');
});
