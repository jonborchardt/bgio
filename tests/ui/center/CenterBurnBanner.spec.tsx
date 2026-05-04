// Defense redesign 3.4 — CenterBurnBanner render + queue tests.
//
// Validates:
//   - A trace with a populated `centerBurnDetail` renders a per-resource
//     summary line (largest first) plus a "to <source> · round N"
//     audit line.
//   - Traces without `centerBurnDetail` render nothing (nullable branch).
//   - The banner auto-dismisses after `displayMs` elapses.
//   - Successive burns queue and surface a "+N more" badge while the
//     active entry is on screen, advancing FIFO as the timer fires.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { CenterBurnBanner } from '../../../src/ui/center/CenterBurnBanner.tsx';
import type { ResolveTrace } from '../../../src/game/track.ts';

// React 19 act() opt-in (mirrors the existing pattern in
// tests/ui/domestic/BuildingTile.test.tsx).
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const burnTrace = (
  detail: ResolveTrace['centerBurnDetail'],
  source = 'Cyclone',
  round = 14,
): ResolveTrace => ({
  pathTiles: [
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ],
  firingUnitIDs: [],
  impactTiles: [],
  centerBurned:
    detail === undefined
      ? undefined
      : Object.values(detail as Record<string, number>).reduce(
          (a, b) => a + b,
          0,
        ),
  centerBurnDetail: detail,
  centerBurnSource: source,
  centerBurnRound: round,
  outcome: 'reachedCenter',
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

const renderWith = (lastResolve: ResolveTrace | undefined): void => {
  act(() => {
    root.render(
      <ThemeProvider theme={theme}>
        <CenterBurnBanner
          lastResolve={lastResolve}
          displayMs={3000}
        />
      </ThemeProvider>,
    );
  });
};

const rerenderWith = (lastResolve: ResolveTrace | undefined): void => {
  renderWith(lastResolve);
};

describe('CenterBurnBanner (3.4)', () => {
  it('renders nothing when lastResolve is undefined', () => {
    renderWith(undefined);
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).toBeNull();
  });

  it('renders nothing for a trace without centerBurnDetail', () => {
    renderWith(burnTrace(undefined));
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).toBeNull();
  });

  it('renders a per-resource summary for a trace with centerBurnDetail', () => {
    renderWith(
      burnTrace({ wood: 3, stone: 1, gold: 1 }, 'Cyclone', 14),
    );
    const banner = container.querySelector(
      '[data-testid="center-burn-banner"]',
    );
    expect(banner).not.toBeNull();
    const text = banner!.textContent ?? '';
    // Headline.
    expect(text).toContain('Center burned');
    // Per-resource breakdown — largest first (wood=3 before stone=1 /
    // gold=1). The `ResourceToken` renders the symbol + the count
    // separately; the spelt-out lowercase resource name follows each
    // token, so the order is "wood … stone … gold".
    expect(text.indexOf('wood')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('stone')).toBeGreaterThan(text.indexOf('wood'));
    // Total + audit line.
    expect(text).toContain('5 total');
    expect(text).toContain('Cyclone');
    expect(text).toContain('round 14');
  });

  it('auto-dismisses after the configured displayMs', () => {
    renderWith(burnTrace({ wood: 2 }));
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).toBeNull();
  });

  it('queues successive burns and surfaces the +N-more badge', () => {
    const a = burnTrace({ wood: 2 }, 'CycloneA', 14);
    const b = burnTrace({ stone: 3 }, 'CycloneB', 15);
    const c = burnTrace({ gold: 1 }, 'CycloneC', 16);

    renderWith(a);
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="center-burn-banner-queue-badge"]',
      ),
    ).toBeNull();

    rerenderWith(b);
    rerenderWith(c);
    // Active is still A; B + C are queued.
    const queueBadge = container.querySelector(
      '[data-testid="center-burn-banner-queue-badge"]',
    );
    expect(queueBadge).not.toBeNull();
    expect(queueBadge!.textContent).toContain('+2 more');
    // First banner shows source A.
    expect(
      container
        .querySelector('[data-testid="center-burn-banner"]')!
        .textContent,
    ).toContain('CycloneA');

    // Advance the timer by displayMs once. The queue advances to B.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const second = container.querySelector(
      '[data-testid="center-burn-banner"]',
    );
    expect(second).not.toBeNull();
    expect(second!.textContent).toContain('CycloneB');
    expect(
      container
        .querySelector(
          '[data-testid="center-burn-banner-queue-badge"]',
        )!
        .textContent,
    ).toContain('+1 more');

    // Advance again — C becomes active, no more queued.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const third = container.querySelector(
      '[data-testid="center-burn-banner"]',
    );
    expect(third).not.toBeNull();
    expect(third!.textContent).toContain('CycloneC');
    expect(
      container.querySelector(
        '[data-testid="center-burn-banner-queue-badge"]',
      ),
    ).toBeNull();

    // Final advance — banner dismisses.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      container.querySelector('[data-testid="center-burn-banner"]'),
    ).toBeNull();
  });

  it('dedupes the same trace identity across re-renders', () => {
    const t = burnTrace({ wood: 1 }, 'CycloneOnce', 10);
    renderWith(t);
    rerenderWith(t);
    rerenderWith(t);
    // No "+N more" — only one entry was enqueued.
    expect(
      container.querySelector(
        '[data-testid="center-burn-banner-queue-badge"]',
      ),
    ).toBeNull();
  });
});
