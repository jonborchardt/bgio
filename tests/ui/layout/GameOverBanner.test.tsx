// 14.5 — GameOverBanner smoke + RTL render checks. Issue 029 closed
// the it.todos here once @testing-library/react landed.

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../src/theme.ts';
import { GameOverBanner } from '../../../src/ui/layout/GameOverBanner.tsx';

const renderBanner = (
  props: Parameters<typeof GameOverBanner>[0],
) =>
  render(
    <ThemeProvider theme={theme}>
      <GameOverBanner {...props} />
    </ThemeProvider>,
  );

describe('GameOverBanner smoke (14.5)', () => {
  it('imports without runtime errors', async () => {
    const mod = await import('../../../src/ui/layout/GameOverBanner.tsx');
    expect(mod).toBeTruthy();
    expect(typeof mod.GameOverBanner).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('win outcome renders "You won!" + the turn count', () => {
    renderBanner({
      outcome: { kind: 'win', turns: 42 },
    });
    expect(screen.getByText('You won!')).toBeTruthy();
    expect(screen.getByText(/Turns taken: 42/)).toBeTruthy();
  });

  it('timeUp outcome renders "Time\'s up" + the round reached', () => {
    renderBanner({
      outcome: { kind: 'timeUp', turns: 80 },
    });
    expect(screen.getByText("Time's up")).toBeTruthy();
    expect(screen.getByText(/Reached turn 80/)).toBeTruthy();
  });

  it('Play again click invokes onPlayAgain', () => {
    const onPlayAgain = vi.fn();
    renderBanner({
      outcome: { kind: 'win', turns: 10 },
      onPlayAgain,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('omits the Play again button when onPlayAgain is not provided', () => {
    renderBanner({
      outcome: { kind: 'win', turns: 10 },
    });
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
  });
});
