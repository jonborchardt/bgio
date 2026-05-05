// Defense redesign 3.3 — resolve animation context tests.
//
// Validates the queue / advance / cleanup behavior of
// `<ResolveAnimationProvider>` plus the `<ResolveTraceWatcher>` thin
// adapter that pushes `G.track.lastResolve` updates through it. We
// drive the provider directly with `act` from `react-dom/test-utils`
// because the project doesn't have @testing-library/react installed.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useContext } from 'react';
import {
  ResolveAnimationProvider,
  ResolveTraceWatcher,
} from '../../../src/ui/track/resolveAnimationContext.tsx';
import {
  ResolveAnimationContext,
  ANIMATION_DURATION_MS,
  MAX_QUEUE_LENGTH,
} from '../../../src/ui/track/resolveAnimation.ts';
import type { ResolveTrace } from '../../../src/game/track.ts';

// React 19 act() opt-in (mirrors the existing pattern in
// tests/ui/domestic/BuildingTile.test.tsx).
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeRecord {
  current: ResolveTrace | null;
  push: (t: ResolveTrace) => void;
}

const Probe: React.FC<{ recordRef: { record: ProbeRecord | null } }> = ({
  recordRef,
}) => {
  const ctx = useContext(ResolveAnimationContext);
  recordRef.record = { current: ctx.current, push: ctx.pushTrace };
  return null;
};

const trace = (
  _id: string,
  outcome: ResolveTrace['outcome'] = 'killed',
): ResolveTrace => ({
  pathTiles: [{ x: 0, y: 1 }],
  firingUnitIDs: [],
  impactTiles: [],
  outcome,
});

describe('ResolveAnimationProvider (3.3)', () => {
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

  it('starts idle (current === null) and accepts a trace push', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });
    const initial = ref.record!.current;
    expect(initial).toBeNull();

    act(() => {
      ref.record!.push(trace('a'));
    });
    expect(ref.record!.current?.outcome).toBe('killed');
  });

  it('clears `current` after ANIMATION_DURATION_MS elapses', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });

    act(() => {
      ref.record!.push(trace('a'));
    });
    expect(ref.record!.current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(ANIMATION_DURATION_MS);
    });
    expect(ref.record!.current).toBeNull();
  });

  it('plays multiple pushed traces in sequence (FIFO)', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });
    const a = trace('a', 'killed');
    const b = trace('b', 'overflowed');
    const c = trace('c', 'reachedCenter');
    act(() => {
      ref.record!.push(a);
      ref.record!.push(b);
      ref.record!.push(c);
    });
    expect(ref.record!.current?.outcome).toBe('killed');
    act(() => {
      vi.advanceTimersByTime(ANIMATION_DURATION_MS);
    });
    expect(ref.record!.current?.outcome).toBe('overflowed');
    act(() => {
      vi.advanceTimersByTime(ANIMATION_DURATION_MS);
    });
    expect(ref.record!.current?.outcome).toBe('reachedCenter');
    act(() => {
      vi.advanceTimersByTime(ANIMATION_DURATION_MS);
    });
    expect(ref.record!.current).toBeNull();
  });

  it('skips `noop` traces — they are not enqueued', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });
    act(() => {
      ref.record!.push(trace('noop', 'noop'));
    });
    // Noop never becomes `current`.
    expect(ref.record!.current).toBeNull();
  });

  it('caps the internal queue at MAX_QUEUE_LENGTH', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });
    // Push way past the cap. The first enqueued trace becomes the
    // current animation; the queue retains at most MAX_QUEUE_LENGTH
    // *additional* entries. The final pushed trace must always be
    // present (newest wins on overflow).
    const expected: ResolveTrace[] = [];
    act(() => {
      for (let i = 0; i < MAX_QUEUE_LENGTH * 2; i += 1) {
        const t = trace(`t${i}`);
        expected.push(t);
        ref.record!.push(t);
      }
    });
    // Drain all timers; if we overshot the cap the test would deadlock.
    act(() => {
      vi.runAllTimers();
    });
    expect(ref.record!.current).toBeNull();
  });

  it('cleans up its pending timer on unmount', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    act(() => {
      root.render(
        <ResolveAnimationProvider>
          <Probe recordRef={ref} />
        </ResolveAnimationProvider>,
      );
    });
    act(() => {
      ref.record!.push(trace('a'));
    });
    expect(ref.record!.current).not.toBeNull();
    // Unmount mid-animation. Advancing timers afterward must not throw.
    act(() => {
      root.unmount();
    });
    expect(() =>
      vi.advanceTimersByTime(ANIMATION_DURATION_MS * 2),
    ).not.toThrow();
  });
});

describe('ResolveTraceWatcher (3.3)', () => {
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

  it('forwards new lastResolve identities into the queue', () => {
    const ref: { record: ProbeRecord | null } = { record: null };
    const a = trace('a');
    const b = trace('b', 'overflowed');

    const App = ({ last }: { last: ResolveTrace | undefined }) => (
      <ResolveAnimationProvider>
        <ResolveTraceWatcher lastResolve={last} />
        <Probe recordRef={ref} />
      </ResolveAnimationProvider>
    );

    act(() => {
      root.render(<App last={undefined} />);
    });
    expect(ref.record!.current).toBeNull();

    act(() => {
      root.render(<App last={a} />);
    });
    expect(ref.record!.current?.outcome).toBe('killed');

    // Re-rendering with the same identity must NOT enqueue twice.
    act(() => {
      root.render(<App last={a} />);
    });
    expect(ref.record!.current?.outcome).toBe('killed');
    act(() => {
      vi.advanceTimersByTime(ANIMATION_DURATION_MS);
    });
    expect(ref.record!.current).toBeNull();

    // A new identity (different object) re-fires the animation.
    act(() => {
      root.render(<App last={b} />);
    });
    expect(ref.record!.current?.outcome).toBe('overflowed');
  });
});
