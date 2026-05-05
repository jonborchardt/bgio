// CentralBoard render tests.
//
// Mirrors the existing UI test pattern: render via
// `react-dom/server`'s `renderToStaticMarkup`, wrap in MUI's
// ThemeProvider, and assert against the resulting HTML string.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { CentralBoard } from '../../../src/ui/centralBoard/CentralBoard.tsx';

const render = (props: Parameters<typeof CentralBoard>[0]): string =>
  renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <CentralBoard {...props} />
    </ThemeProvider>,
  );

describe('CentralBoard', () => {
  it('renders the track + village nodes inside the central board frame', () => {
    const html = render({
      track: <div data-testid="track-mock">TRACK</div>,
      village: <div data-testid="village-mock">VILLAGE</div>,
    });
    expect(html).toContain('data-testid="central-board"');
    expect(html).toContain('TRACK');
    expect(html).toContain('VILLAGE');
  });

  it('renders header status pills when stats are supplied', () => {
    const html = render({
      track: null,
      village: null,
      stats: [
        { label: 'Round', value: '3' },
        { label: 'Phase', value: '4/10', ariaLabel: 'Track phase 4 of 10' },
        { label: 'Science', value: '2' },
      ],
    });
    expect(html).toContain('data-testid="central-board-stat-round"');
    expect(html).toContain('data-testid="central-board-stat-phase"');
    expect(html).toContain('data-testid="central-board-stat-science"');
    expect(html).toContain('aria-label="Track phase 4 of 10"');
    expect(html).toContain('>3<');
    expect(html).toContain('>4/10<');
  });

  it('omits the stats row when stats is empty / undefined', () => {
    const html = render({
      track: null,
      village: null,
      stats: [],
    });
    expect(html).not.toContain('central-board-stat-');
  });

  it('renders an overlay node into the village content well', () => {
    const html = render({
      track: null,
      village: <div>VILLAGE</div>,
      overlay: <div data-testid="overlay-mock">OVERLAY</div>,
    });
    expect(html).toContain('OVERLAY');
    expect(html).toContain('data-testid="overlay-mock"');
  });
});
