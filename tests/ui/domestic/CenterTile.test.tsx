// Defense redesign 3.2 — CenterTile render tests.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { CenterTile } from '../../../src/ui/domestic/CenterTile.tsx';

const renderTile = (
  pooledTotal: number,
  pooledBreakdown?: Array<{ resource: string; amount: number }>,
): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <CenterTile pooledTotal={pooledTotal} pooledBreakdown={pooledBreakdown} />
    </ThemeProvider>,
  );

describe('CenterTile (defense redesign 3.2)', () => {
  it('renders the live pooled-stash total on the vault face', () => {
    const html = renderTile(7);
    expect(html).toContain('data-center-tile="true"');
    expect(html).toContain('data-center-pooled="7"');
    // Vault label + "pooled stash" subline.
    expect(html).toContain('Vault');
    expect(html).toContain('pooled stash');
    // Aria-label echoes the total for screen readers.
    expect(html).toContain('aria-label="Village vault — pooled stash 7"');
  });

  it('renders 0 when the pool is empty', () => {
    const html = renderTile(0);
    expect(html).toContain('data-center-pooled="0"');
  });

  it('accepts a per-resource breakdown without crashing', () => {
    // The breakdown is surfaced via the tooltip body — under
    // renderToStaticMarkup the tooltip body lives in the title prop
    // and isn't always inlined, so we just verify the component
    // accepts the prop and still surfaces the headline number.
    const html = renderTile(5, [
      { resource: 'wood', amount: 2 },
      { resource: 'stone', amount: 3 },
    ]);
    expect(html).toContain('data-center-pooled="5"');
  });
});
