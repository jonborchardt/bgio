// Defense redesign 3.4 — center-burn banner.
//
// When a threat (or a boss attack) reaches the village vault and burns
// from the non-chief seats' pooled stash, the resolver writes the
// per-resource breakdown onto `G.track.lastResolve.centerBurnDetail`
// (along with the offending card name + round number). This component
// surfaces that loss as a short-lived floating banner so the table can
// glance and read "we lost X resources to this card."
//
// Behavior:
//   - Subscribes to `lastResolve` (passed as a prop, mirroring
//     <ResolveTraceWatcher> from 3.3). Every new identity with
//     `centerBurnDetail !== undefined` enqueues a banner entry.
//   - Shows one banner at a time for `BANNER_DISPLAY_MS` (default 3s).
//     When the queue holds more than one entry, the active banner shows
//     a "+N more" badge so the table knows there are stacked burns.
//     After the timer fires, the banner advances to the next entry (or
//     dismisses if the queue is empty).
//   - The banner is visually layered (`position: absolute`) but does NOT
//     capture pointer events — the seat tiles underneath stay fully
//     interactive so dismissal is implicit (no click required).
//
// Visual:
//   line 1: "−3 wood, −1 stone, −1 gold burned"
//   line 2: "to <ThreatName> | round 14"   (with a "+N more" pill if
//                                           the queue is non-empty)
//
// All colors flow through `palette.centerBurnBanner.*` (theme.ts) — no
// raw hex literals leak into the component.

import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { ResolveTrace } from '../../game/track.ts';
import {
  RESOURCES,
  type Resource,
  RESOURCE_DISPLAY,
} from '../../game/resources/types.ts';
import { ResourceToken } from '../resources/ResourceToken.tsx';
import { useReducedMotion } from '../layout/useReducedMotion.ts';

/** Total time a single burn entry stays on screen, in ms. The plan
 *  asks for ~3s; long enough to read both lines, short enough that
 *  "watch the threat hit" doesn't stall on the banner. Exposed so
 *  tests can drive the queue with fake timers. */
export const BANNER_DISPLAY_MS = 3000;

/** Hard cap on the queue. A single boss flip can push up to ~8 burn
 *  traces; we accept a queue of up to MAX_QUEUE entries before
 *  collapsing the oldest under the "+N more" badge. */
export const MAX_QUEUE_LENGTH = 16;

/** Per-burn entry. Built off a `ResolveTrace` whose `centerBurnDetail`
 *  is set; we hold onto the identity so re-renders dedupe. */
interface BurnEntry {
  readonly trace: ResolveTrace;
  readonly detail: Partial<Record<Resource, number>>;
  readonly source: string;
  readonly round: number;
}

const traceToEntry = (trace: ResolveTrace): BurnEntry | null => {
  const detail = trace.centerBurnDetail;
  if (detail === undefined) return null;
  // Defensive: drop entries with empty / zero-only detail; the resolver
  // already filters those out, but a future content shape might emit
  // them and we don't want a banner for "0 burned."
  let any = false;
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = (detail as Partial<Record<Resource, number>>)[r];
    if (v !== undefined && v > 0) {
      any = true;
      break;
    }
  }
  if (!any) return null;
  return {
    trace,
    detail: detail as Partial<Record<Resource, number>>,
    source: trace.centerBurnSource ?? 'a threat',
    round: trace.centerBurnRound ?? 0,
  };
};

/** Sort the burn detail by amount (largest first) so the banner reads
 *  the worst loss out loud first. Stable on ties so the iteration order
 *  matches the canonical RESOURCES order. */
const sortedDetail = (
  detail: Partial<Record<Resource, number>>,
): Array<{ resource: Resource; count: number }> => {
  const entries: Array<{ resource: Resource; count: number }> = [];
  for (const r of RESOURCES as ReadonlyArray<Resource>) {
    const v = detail[r];
    if (v === undefined || v === 0) continue;
    entries.push({ resource: r, count: v });
  }
  entries.sort((a, b) => b.count - a.count);
  return entries;
};

export interface CenterBurnBannerProps {
  /** The latest ResolveTrace appended to `G.track.traces`. Mirrors the
   *  prop shape of <ResolveTraceWatcher> so the Board can pass the same
   *  field through. The banner watches identity changes — passing the
   *  same trace twice is a no-op. */
  lastResolve?: ResolveTrace;
  /** Override the auto-fade duration. Tests pass a small value to drive
   *  the queue without wall-clock waits. */
  displayMs?: number;
  /** Test seam — when supplied, the component reads its initial trace
   *  from this value instead of `lastResolve`. Lets tests render the
   *  banner without wiring a parent that publishes traces over time. */
  initialEntry?: BurnEntry;
}

export function CenterBurnBanner({
  lastResolve,
  displayMs = BANNER_DISPLAY_MS,
  initialEntry,
}: CenterBurnBannerProps) {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<BurnEntry | null>(
    initialEntry ?? null,
  );
  const queueRef = useRef<BurnEntry[]>([]);
  const lastSeenRef = useRef<ResolveTrace | null>(
    initialEntry?.trace ?? null,
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queueLength, setQueueLength] = useState<number>(0);

  // Advance: pull the next entry off the queue, set it active, and arm
  // the timer. When the queue is empty, drop the active entry so the
  // banner unmounts.
  const advance = (): void => {
    const next = queueRef.current.shift() ?? null;
    setQueueLength(queueRef.current.length);
    setActive(next);
    if (next === null) {
      timeoutRef.current = null;
      return;
    }
    timeoutRef.current = setTimeout(advance, displayMs);
  };

  // Watch `lastResolve` for new identities carrying a center-burn
  // detail. Push them onto the queue and kick the advance pump if it's
  // not already running.
  useEffect(() => {
    if (lastResolve === undefined) return;
    if (lastSeenRef.current === lastResolve) return;
    lastSeenRef.current = lastResolve;

    const entry = traceToEntry(lastResolve);
    if (entry === null) return;

    // Drop oldest under cap to keep memory bounded under pathological
    // inputs.
    if (queueRef.current.length >= MAX_QUEUE_LENGTH) {
      queueRef.current.shift();
    }
    queueRef.current.push(entry);
    setQueueLength(queueRef.current.length);

    // If nothing is currently showing, advance immediately so the new
    // entry becomes active.
    if (timeoutRef.current === null && active === null) {
      advance();
    }
    // `advance` is stable across renders (closes over refs only); no
    // dependency churn here. We deliberately don't list `active` /
    // `advance` in the deps — that would re-fire the effect every time
    // the active entry changes and re-enqueue stale traces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResolve]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  if (active === null) return null;

  const entries = sortedDetail(active.detail);
  const total = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <Box
      data-testid="center-burn-banner"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      sx={(t) => ({
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        // Don't block clicks on the seat tiles underneath — the banner
        // is purely informational.
        pointerEvents: 'none',
        bgcolor: t.palette.centerBurnBanner.surface,
        color: t.palette.centerBurnBanner.text,
        border: `1px solid ${t.palette.centerBurnBanner.accent}`,
        borderRadius: 1,
        boxShadow: t.palette.shadow.floating,
        px: 1.5,
        py: 1,
        minWidth: 0,
        maxWidth: '32rem',
        // Fade-in / fade-out animation. Sums to roughly the configured
        // displayMs so the visible window matches the timer.
        // Defense-redesign 3.9: respect prefers-reduced-motion — when
        // set, the banner appears static at full opacity (the queue
        // timer still advances so the banner still cycles, just without
        // the slide / fade keyframes).
        opacity: 1,
        animation: reducedMotion
          ? 'none'
          : 'centerBurnBannerFade 3s ease-in-out forwards',
        '@keyframes centerBurnBannerFade': {
          '0%': { opacity: 0, transform: 'translate(-50%, -8px)' },
          '10%': { opacity: 1, transform: 'translate(-50%, 0)' },
          '85%': { opacity: 1, transform: 'translate(-50%, 0)' },
          '100%': { opacity: 0, transform: 'translate(-50%, 0)' },
        },
      })}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ flexWrap: 'wrap', minWidth: 0, alignItems: 'center' }}
        >
          <Typography
            component="span"
            sx={(t) => ({
              fontWeight: 700,
              color: t.palette.centerBurnBanner.accent,
              letterSpacing: '0.02em',
            })}
          >
            Center burned
          </Typography>
          {entries.map((e) => (
            <Stack
              key={e.resource}
              direction="row"
              spacing={0.25}
              sx={{ alignItems: 'center' }}
            >
              <ResourceToken
                resource={e.resource}
                count={e.count}
                sign="-"
                size="small"
              />
              <Typography
                component="span"
                sx={(t) => ({
                  fontSize: '0.85rem',
                  color: t.palette.centerBurnBanner.text,
                })}
                title={`-${e.count} ${RESOURCE_DISPLAY[e.resource].name}`}
              >
                {RESOURCE_DISPLAY[e.resource].name.toLowerCase()}
              </Typography>
            </Stack>
          ))}
          <Typography
            component="span"
            sx={(t) => ({
              fontSize: '0.85rem',
              color: t.palette.centerBurnBanner.subText,
            })}
          >
            ({total} total)
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ minWidth: 0, alignItems: 'center' }}
        >
          <Typography
            component="span"
            sx={(t) => ({
              fontSize: '0.8rem',
              color: t.palette.centerBurnBanner.subText,
            })}
          >
            to {active.source}
            {active.round > 0 ? ` · round ${active.round}` : null}
          </Typography>
          {queueLength > 0 ? (
            <Box
              data-testid="center-burn-banner-queue-badge"
              sx={(t) => ({
                fontSize: '0.7rem',
                fontWeight: 700,
                px: 0.6,
                py: 0.1,
                borderRadius: 0.6,
                bgcolor: t.palette.centerBurnBanner.accent,
                color: t.palette.centerBurnBanner.text,
              })}
            >
              +{queueLength} more
            </Box>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Convenience wrapper that pulls `lastResolve` from a prop typed as
 * `SettlementState['track']`. Lets the Board pass `G.track` straight
 * through without spreading the field. Tests prefer the lower-level
 * `<CenterBurnBanner lastResolve={...} />` form.
 */
export interface CenterBurnBannerHostProps {
  track: { lastResolve?: ResolveTrace } | undefined;
}

export function CenterBurnBannerHost({ track }: CenterBurnBannerHostProps) {
  return <CenterBurnBanner lastResolve={track?.lastResolve} />;
}

/**
 * Helper exported for tests: build a BurnEntry from a trace. Keeps the
 * banner's queueing logic in one file while letting tests construct
 * synthetic entries without re-implementing the parse.
 */
export const __testBurnEntry = (trace: ResolveTrace): BurnEntry | null =>
  traceToEntry(trace);
