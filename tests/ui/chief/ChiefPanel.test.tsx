// 04.5 — ChiefPanel smoke tests.
//
// `@testing-library/react` is not installed in this repo (see package.json),
// so the rich render-and-click assertions sketched in 04.5's plan are gated
// behind a TODO and only the import-without-crashing smoke check actually
// runs. When RTL is added later, replace the TODOs below with real tests:
//
//   - render the panel for numPlayers ∈ {1, 2, 4} via a ThemeProvider +
//     a hand-rolled BoardProps stub.
//   - assert that "End my turn" calls a chiefEndPhase mock.
//   - assert that "+1 gold" on seat 1 calls
//     chiefDistribute('1', { gold: 1 }) on the moves mock.

import { describe, expect, it } from 'vitest';

describe('ChiefPanel smoke (04.5)', () => {
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

  // TODO(04.5): once @testing-library/react is added, replace the smoke
  // test above with the three render-and-click checks listed in the file
  // header comment.
  it.todo('renders without crashing for numPlayers ∈ {1, 2, 4}');
  it.todo('clicking "End my turn" calls chiefEndPhase');
  it.todo("clicking '+1 gold' on seat 1 calls chiefDistribute('1', { gold: 1 })");
});
