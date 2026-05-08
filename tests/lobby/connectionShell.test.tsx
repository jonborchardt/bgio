// Plan 02 — ConnectionShell coverage.
//
// We use RTL + vitest fake timers to exercise the loading-shell phase
// transitions without waiting for real wall-clock seconds. The bgio
// Client wires this component as the `loading` prop so it renders
// while the initial sync is pending.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../src/theme.ts';
import {
  ConnectionShell,
  RETRY_DELAYS_MS,
  RETRY_BUTTON_THRESHOLD,
} from '../../src/lobby/ConnectionShell.tsx';

const mount = () =>
  render(
    <ThemeProvider theme={theme}>
      <ConnectionShell />
    </ThemeProvider>,
  );

describe('ConnectionShell (plan 02)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('imports without runtime errors and renders a default export', async () => {
    const mod = await import('../../src/lobby/ConnectionShell.tsx');
    expect(typeof mod.ConnectionShell).toBe('function');
    expect(typeof mod.default).toBe('function');
  });

  it('shows just the spinner + label at initial mount', () => {
    vi.useFakeTimers();
    mount();
    expect(screen.getByText('Connecting…')).toBeTruthy();
    expect(screen.queryByText('Retry now')).toBeNull();
    expect(screen.queryByText('Back to lobby')).toBeNull();
  });

  it('upgrades the label after the first backoff window', async () => {
    vi.useFakeTimers();
    mount();
    await act(async () => {
      // advanceTimersByTimeAsync flushes microtasks between chained
      // timers — important here because each setTimeout fires a React
      // state update which re-runs the useEffect to schedule the next
      // timer. The sync advance can fire all timers but only schedule
      // one re-render, so we'd see attempt=1 instead of the linearly
      // incremented sequence.
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + 5);
    });
    expect(screen.getByText(/Connecting \(attempt 2\)/)).toBeTruthy();
    // Recovery buttons still hidden — threshold is RETRY_BUTTON_THRESHOLD (2).
    expect(screen.queryByText('Retry now')).toBeNull();
  });

  it('reveals the recovery buttons once attempt reaches the threshold', async () => {
    vi.useFakeTimers();
    mount();
    // Step the timer in per-attempt chunks so each setAttempt's
    // re-render flushes before the next setTimeout schedules.
    for (let i = 0; i < RETRY_BUTTON_THRESHOLD; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[i] + 5);
      });
    }
    expect(screen.getByText('Retry now')).toBeTruthy();
    expect(screen.getByText('Back to lobby')).toBeTruthy();
    // Cold-start hint is part of the recovery view.
    expect(screen.getByText(/cold-starting/)).toBeTruthy();
  });
});
