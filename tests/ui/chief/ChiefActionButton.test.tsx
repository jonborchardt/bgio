// ChiefActionButton render tests — covers the flip / end mode switch
// and the disabled state. Click handler wiring is verified via the
// data attributes the button writes (the testbed renders to static
// markup so we don't drive real click events here).

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { ChiefActionButton } from '../../../src/ui/chief/ChiefActionButton.tsx';

const render = (props: Parameters<typeof ChiefActionButton>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <ChiefActionButton {...props} />
    </ThemeProvider>,
  );

const baseProps: Parameters<typeof ChiefActionButton>[0] = {
  canAct: true,
  hasTrack: true,
  flipped: false,
  upcomingCount: 12,
  onFlip: vi.fn(),
  onEnd: vi.fn(),
};

describe('ChiefActionButton', () => {
  it('renders in flip mode when the round has not been flipped', () => {
    const html = render(baseProps);
    expect(html).toContain('data-chief-action-mode="flip"');
    expect(html).toContain('Flip Track');
    expect(html).not.toContain('End my turn');
    // F shortcut hint visible.
    expect(html).toContain('(F)');
  });

  it('renders in end mode after the round flip latches', () => {
    const html = render({ ...baseProps, flipped: true });
    expect(html).toContain('data-chief-action-mode="end"');
    expect(html).toContain('End my turn');
    expect(html).not.toContain('Flip Track');
  });

  it('renders in end mode when there is no track', () => {
    const html = render({ ...baseProps, hasTrack: false });
    expect(html).toContain('data-chief-action-mode="end"');
  });

  it('renders in end mode when the deck is exhausted', () => {
    const html = render({ ...baseProps, upcomingCount: 0 });
    expect(html).toContain('data-chief-action-mode="end"');
  });

  it('marks itself disabled when canAct is false', () => {
    const html = render({ ...baseProps, canAct: false });
    expect(html).toContain('data-chief-action-disabled="true"');
  });
});
