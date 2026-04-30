// 10.5 — ChatComposer smoke tests. RTL is not installed, so the
// assertion is just that the module resolves and exports the expected
// functions; user-event-driven assertions live as it.todo.

import { describe, expect, it } from 'vitest';

describe('ChatComposer (10.5)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/chat/ChatComposer.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.ChatComposer).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it.todo('Send button is disabled when text is empty / whitespace only');
  it.todo('clamps text to 280 chars at the input boundary');
  it.todo('onSend receives the trimmed text and the field clears');
  it.todo('Enter submits, Shift+Enter does not (single-line for V1)');
});
