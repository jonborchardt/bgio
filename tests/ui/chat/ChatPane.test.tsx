// 10.5 — ChatPane smoke tests. RTL is not installed, so the assertion
// is just that the module resolves and exports the expected functions;
// render-and-assert checks live as it.todo placeholders matching the
// pattern from tests/ui/layout/BoardShell.test.tsx.

import { describe, expect, it } from 'vitest';

describe('ChatPane (10.5)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chat/ChatPane.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChatPane).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('renders nothing-empty placeholder when chatMessages is []');
  it.todo('renders one row per chatMessages entry, escaping HTML in text');
  it.todo('auto-scrolls to bottom when chatMessages grows');
});
