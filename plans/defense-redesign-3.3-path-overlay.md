# Sub-phase 3.3 — Path overlay + threat resolve animation

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10.3 + §3 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 3.1 + 3.2 merged.

## Goal

When a threat resolves, briefly highlight its path on the grid so
the table can read what just happened — direction, which tiles it
touched, where it died (if it did), where it overflowed to. The
animation is short and non-blocking.

## Files touched

- `src/ui/track/PathOverlay.tsx` (new).
- `src/ui/track/resolveAnimationContext.tsx` (new) — small React
  context that buffers the most recent resolve event from the
  resolver.
- `src/game/track/resolver.ts` — emit a structured `resolve event`
  after each card flip. Possibly via a small subscription bus that
  the UI listens to (or just attach to `G.track.history` —
  recommend the latter, no new infra).
- `src/ui/Board.tsx` — mount the overlay layer.
- `src/ui/domestic/DomesticGrid.tsx` — accept an optional
  `pathHighlight` prop and render highlighted tiles distinctly.

## Approach

The simplest path: attach a `resolveTrace` to each entry in
`G.track.history`:

```ts
interface TrackHistoryEntry {
  card: TrackCardDef;
  trace?: ResolveTrace;
}

interface ResolveTrace {
  pathTiles: Array<{ x: number; y: number }>;
  firingUnitIDs: string[];
  impactTiles: string[];        // cellKeys hit, in order
  centerBurned?: number;
  outcome: 'killed' | 'overflowed' | 'reachedCenter';
}
```

The resolver in 2.3 fills `trace` as it runs. UI reads
`history[history.length - 1]` for the most recent. When
`history` changes (new entry appended), the overlay animates that
entry's `pathTiles` for ≤ 500 ms then dismisses.

Animation choices:

- Highlight pathTiles with a directional gradient (origin →
  center).
- Pulse impactTiles in red (just briefly).
- If centerBurned > 0, ripple from center outward.

Keep it short (250 – 500 ms total). Game continues immediately
after the animation finishes.

## Component shape

```tsx
const PathOverlay: React.FC<{ trace?: ResolveTrace }> = ({ trace }) => {
  // useEffect on trace change starts the timer; renders nothing
  // when timer is inactive.
};
```

Render layer should sit *over* the domestic grid but not capture
clicks. Use a transparent absolute-positioned div with
`pointer-events: none`.

## Tests

- Trace renders as expected for a threat that:
  - is killed by units mid-path (highlight stops at kill tile).
  - overflows through 1–2 buildings.
  - reaches center (ripple plays).
- No trace → no overlay.
- Animation cleans up after duration; no memory leaks across
  many flips.

## Out of scope

- Center-burn announcement banner (3.4).
- Boss attack pattern (each boss attack should produce its own
  trace; the same overlay reuses for each. No special boss
  rendering here.)

## Done when

- A flip in hot-seat plays the path animation.
- Multiple flips in quick succession (e.g. boss multi-attack) play
  in sequence without queueing infinitely or dropping frames.
- All overlay visuals come from `src/theme.ts`.
- Tests pass.
