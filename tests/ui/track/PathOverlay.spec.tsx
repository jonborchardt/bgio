// Defense redesign 3.3 — PathOverlay render tests.
//
// We render via `react-dom/server`'s `renderToStaticMarkup`, wrap in
// MUI's ThemeProvider plus the resolve-animation context, and assert on
// the resulting HTML markup.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { PathOverlay } from '../../../src/ui/track/PathOverlay.tsx';
import { ResolveAnimationContext } from '../../../src/ui/track/resolveAnimation.ts';
import type { ResolveTrace } from '../../../src/game/track.ts';

const renderWithTrace = (trace: ResolveTrace | null): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <ResolveAnimationContext.Provider
        value={{
          current: trace,
          // PathOverlay reads only `current` — the step fields are
          // stubbed so the context type is satisfied. Cell-level tints
          // (which depend on currentStep) aren't exercised by these
          // tests; they live in the resolveAnimationContext.spec.
          currentStep: null,
          currentStepIndex: -1,
          totalSteps: 0,
          advance: () => undefined,
          pushTrace: () => undefined,
        }}
      >
        <PathOverlay />
      </ResolveAnimationContext.Provider>
    </ThemeProvider>,
  );

describe('PathOverlay (3.3)', () => {
  it('renders nothing when no trace is active', () => {
    const html = renderWithTrace(null);
    expect(html).toBe('');
  });

  it('renders nothing for a trace with empty pathTiles', () => {
    const html = renderWithTrace({
      pathTiles: [],
      firingUnitIDs: [],
      impactTiles: [],
      outcome: 'noop',
    });
    expect(html).toBe('');
  });

  it('renders a polyline + outcome attr when a threat trace is active', () => {
    const html = renderWithTrace({
      pathTiles: [
        { x: 0, y: 2 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      firingUnitIDs: ['u1'],
      impactTiles: ['0,1'],
      outcome: 'overflowed',
    });
    expect(html).toContain('data-testid="path-overlay"');
    expect(html).toContain('data-trace-outcome="overflowed"');
    expect(html).toContain('<polyline');
    // Aria-hidden so screen readers don't announce a transient overlay.
    expect(html).toContain('aria-hidden');
  });

  it('renders a center ripple when the trace reachedCenter with a burn', () => {
    const html = renderWithTrace({
      pathTiles: [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      firingUnitIDs: [],
      impactTiles: [],
      centerBurned: 3,
      outcome: 'reachedCenter',
    });
    expect(html).toContain('data-trace-outcome="reachedCenter"');
    // The ripple is the third <circle> after the head + tail markers.
    const circleCount = (html.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(3);
  });

  it('omits the center ripple for a `killed` trace with no center burn', () => {
    const html = renderWithTrace({
      pathTiles: [
        { x: 0, y: 2 },
        { x: 0, y: 1 },
      ],
      firingUnitIDs: ['u1'],
      impactTiles: [],
      outcome: 'killed',
    });
    expect(html).toContain('data-trace-outcome="killed"');
    // Head + tail markers only.
    const circleCount = (html.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(2);
  });
});
