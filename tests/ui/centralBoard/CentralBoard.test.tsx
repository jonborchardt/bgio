// CentralBoard render tests.

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
  it('renders the track + village nodes inside the board frame', () => {
    const html = render({
      track: <div data-testid="track-mock">TRACK</div>,
      village: <div data-testid="village-mock">VILLAGE</div>,
    });
    expect(html).toContain('data-testid="central-board"');
    expect(html).toContain('TRACK');
    expect(html).toContain('VILLAGE');
  });

  it('renders the science + economy tracker slots', () => {
    const html = render({
      track: null,
      village: null,
      scienceTracker: <div data-testid="science-mock">SCIENCE</div>,
      economyTracker: <div data-testid="economy-mock">ECONOMY</div>,
    });
    expect(html).toContain('data-testid="central-board-science-slot"');
    expect(html).toContain('data-testid="central-board-economy-slot"');
    expect(html).toContain('SCIENCE');
    expect(html).toContain('ECONOMY');
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
