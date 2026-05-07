// Issue 028 — pin the perf invariant: when the modal is closed,
// changing `matchState` (= `G`) must NOT rebuild the card graph.
// Every bgio move emits a fresh `G` tree; the previous code
// rebuilt the graph on every move whether or not the modal was open.
//
// Strategy: mock `buildCardGraph` with a counting stub, render the
// modal closed twice with different match states, assert the stub
// was called at most once. Then open the modal and verify it
// rebuilds.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';

// vi.mock must be hoisted; the spy itself is just a plain `vi.fn`
// the test body reads `mock.calls.length` from. Typed loosely on
// purpose — the modal under test only cares that *some* graph
// shape comes back.
const buildCardGraphSpy = vi.fn((..._args: unknown[]) => ({
  nodes: [],
  edges: [],
  warnings: [],
  byId: new Map(),
}));

vi.mock('../../../src/cards/relationships.ts', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/cards/relationships.ts')
  >('../../../src/cards/relationships.ts');
  return {
    ...actual,
    buildCardGraph: (m?: unknown) => buildCardGraphSpy(m),
  };
});

import { RelationshipsModal } from '../../../src/ui/relationships/RelationshipsModal.tsx';

declare global {

  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom doesn't implement ResizeObserver, but @xyflow/react (used by
// one of the relationship-graph variations) reaches for it on mount.
// Stub a no-op so the open-modal render path doesn't blow up.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  buildCardGraphSpy.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('RelationshipsModal — graph-build perf gate (issue 028)', () => {
  it('does not rebuild the graph when matchState changes while closed', () => {
    const noClose = () => undefined;
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <RelationshipsModal
            open={false}
            onClose={noClose}
            matchState={{ snapshot: 1 } as object}
          />
        </ThemeProvider>,
      );
    });
    const callsAfterFirstRender = buildCardGraphSpy.mock.calls.length;

    // Simulate a bgio move: matchState identity churns. With the modal
    // closed, the cached graph must be reused.
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <RelationshipsModal
            open={false}
            onClose={noClose}
            matchState={{ snapshot: 2 } as object}
          />
        </ThemeProvider>,
      );
    });
    expect(buildCardGraphSpy.mock.calls.length).toBe(callsAfterFirstRender);
  });

  it('rebuilds when the modal opens (the user is about to view it)', () => {
    const noClose = () => undefined;
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <RelationshipsModal
            open={false}
            onClose={noClose}
            matchState={{ snapshot: 1 } as object}
          />
        </ThemeProvider>,
      );
    });
    const closedCalls = buildCardGraphSpy.mock.calls.length;

    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <RelationshipsModal
            open
            onClose={noClose}
            matchState={{ snapshot: 1 } as object}
          />
        </ThemeProvider>,
      );
    });
    expect(buildCardGraphSpy.mock.calls.length).toBeGreaterThan(closedCalls);
  });
});
