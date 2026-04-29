// 14.1 — SeatPicker smoke tests.
//
// `@testing-library/react` is not installed in this repo, so the rich
// render-and-click assertions sketched in 14.1's plan are gated behind
// `it.todo` and only the import-without-crashing smoke check actually
// runs. When RTL is added later, replace the TODOs below with real
// tests:
//
//   - 4-player hot-seat boots with chief panel visible.
//   - Clicking the "Player 2" tab calls onChange('1').
//   - 2-player game: tab labels show the doubled-up roles
//     ("Player 1: chief, science").
//   - Networked mode (no onChange) renders the read-only badge.

import { describe, expect, it } from 'vitest';

describe('SeatPicker smoke (14.1)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/SeatPicker.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.SeatPicker).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('SeatPickerContext imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/SeatPickerContext.ts');
    expect(mod).toBeTruthy();
    expect(mod.SeatPickerContext).toBeTruthy();
  });

  it.todo('4-player hot-seat boots with the chief panel visible');
  it.todo("clicking the 'Player 2' tab calls onChange('1')");
  it.todo("2-player game: 'Player 1: chief, science' label");
  it.todo('networked mode (no onChange) renders the read-only badge');
});
