// Issue 011 — keyboard activation for the village grid cell.
//
// We mount a clickable empty cell and verify Enter / Space dispatch the
// onClick handler the same way a mouse press would.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { CellSlot } from '../../../src/ui/domestic/CellSlot.tsx';

declare global {

  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const findCell = (): HTMLElement => {
  const el = container.querySelector('[role="button"]');
  if (!el) throw new Error('cell not found');
  return el as HTMLElement;
};

describe('CellSlot keyboard activation', () => {
  it('Enter fires onClick', () => {
    let clicks = 0;
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <CellSlot
            x={0}
            y={0}
            isLegal
            isPlacing
            onClick={() => {
              clicks++;
            }}
          />
        </ThemeProvider>,
      );
    });
    const cell = findCell();
    act(() => {
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });
    expect(clicks).toBe(1);
  });

  it('Space fires onClick', () => {
    let clicks = 0;
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <CellSlot
            x={0}
            y={0}
            isLegal
            isPlacing
            onClick={() => {
              clicks++;
            }}
          />
        </ThemeProvider>,
      );
    });
    const cell = findCell();
    act(() => {
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      );
    });
    expect(clicks).toBe(1);
  });

  it('Tab does NOT fire onClick', () => {
    let clicks = 0;
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <CellSlot
            x={0}
            y={0}
            isLegal
            isPlacing
            onClick={() => {
              clicks++;
            }}
          />
        </ThemeProvider>,
      );
    });
    const cell = findCell();
    act(() => {
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
      );
    });
    expect(clicks).toBe(0);
  });
});
