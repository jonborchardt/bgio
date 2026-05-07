// ResolveStepBanner render + click tests.
//
// Mounts the banner with a stubbed ResolveAnimationContext value so we
// can drive each branch (idle / mid-step / last step) without booting
// the real provider.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { ResolveStepBanner } from '../../../src/ui/track/ResolveStepBanner.tsx';
import { ResolveAnimationContext } from '../../../src/ui/track/resolveAnimation.ts';
import type { ResolveStep } from '../../../src/ui/track/resolveSteps.ts';

const renderBanner = (
  step: ResolveStep | null,
  index: number,
  total: number,
  advance: () => void = vi.fn(),
): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <ResolveAnimationContext.Provider
        value={{
          current: null,
          currentStep: step,
          currentStepIndex: index,
          totalSteps: total,
          advance,
          pushTrace: () => undefined,
        }}
      >
        <ResolveStepBanner />
      </ResolveAnimationContext.Provider>
    </ThemeProvider>,
  );

const enterStep: ResolveStep = {
  kind: 'enter',
  description: 'Threat advances toward the vault.',
  pathTiles: [{ x: 0, y: 1 }],
  pathKeys: new Set(['0,1']),
  impactKeys: new Set(),
  firingUnitIDs: new Set(),
};

describe('ResolveStepBanner', () => {
  it('renders nothing when idle', () => {
    const html = renderBanner(null, -1, 0);
    expect(html).toBe('');
  });

  it('renders the step description + index when a step is active', () => {
    const html = renderBanner(enterStep, 0, 3);
    expect(html).toContain('data-testid="resolve-step-banner"');
    expect(html).toContain(enterStep.description);
    expect(html).toContain('1/3');
    // Continue label, since this isn't the last step.
    expect(html).toContain('Continue');
  });

  it('renders the Finish label on the last step', () => {
    const html = renderBanner(enterStep, 2, 3);
    expect(html).toContain('Finish');
  });
});
