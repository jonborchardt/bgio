# Sub-phase 3.1 — Track strip component

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10.1 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** Phase 2 fully merged.

## Goal

Build the visual track strip — past cards, current card, next
card (telegraphed), with phase markers above. This is the central
new UI piece; nearly every other Phase-3 component refers to it.

## Files touched

- `src/ui/track/TrackStrip.tsx` (new).
- `src/ui/track/TrackCardView.tsx` (new) — single-card render.
- `src/ui/track/PhaseMarker.tsx` (new) — small phase indicator.
- `src/ui/Board.tsx` — slot the TrackStrip into the board layout
  (likely above the center mat, full width).
- `src/theme.ts` — add palette tokens: `track.past`, `track.current`,
  `track.next`, `track.boss`, plus phase-N colors if the design
  wants them.
- `tests/ui/track/TrackStrip.spec.tsx` (new) — basic render tests.

## Component shape

```tsx
interface TrackStripProps {
  history: TrackCardDef[];   // played, oldest first
  current?: TrackCardDef;    // just-flipped this round
  next?: TrackCardDef;       // telegraphed face-up
  upcomingCount: number;     // number of cards still in deck after `next`
  phase: number;             // currentPhase
}
```

Layout (left → right):

```
[ phase marker  phase marker  phase marker … boss marker ]
[ past₁ past₂ … past_n   |  CURRENT   |  NEXT  |  ░ ░ ░ ░  (face-down hint) ]
```

- **Past cards** are greyed out, smaller, with name + phase number.
  Hover-tooltip shows full text.
- **Current card** is highlighted (fresh flip). On round transition,
  it slides one slot to the left to become the newest "past" card,
  while `next` slides into the current slot. Animate at ~250 ms.
- **Next card** is full-color, face-up, prominent. This is what
  defense plans against.
- **Face-down hint**: a row of ░ tiles representing the count of
  cards still after `next`. Decrements as the track plays.
- **Phase markers** sit above each card position to show which
  phase it belongs to. Boss marker is distinct (e.g. a small icon
  + label "Boss").

## Visual tokens

Add to `src/theme.ts` (per CLAUDE.md no-raw-hex rule):

```ts
declare module '@mui/material/styles' {
  interface Palette {
    track: {
      past: string;
      current: string;
      next: string;
      boss: string;
      phaseMarkers: string[];   // length 10
    };
  }
}
```

Concrete values: pull from existing `ramps` rather than introducing
new hexes. Example: `past = ramps.gray[40]`, `current = ramps.amber[60]`,
`next = ramps.amber[70]`, `boss = ramps.red[70]`, phase markers a
gradient across `ramps.purple[20..80]`.

## Card view

Each `TrackCardView` shows:

- Name
- Kind icon (sword for threat, leaf for boon, gear for modifier,
  crown for boss)
- For threat: direction arrow + offset, strength
- For boon / modifier: brief effect summary
- For boss: thresholds preview (with current vs required if the
  village has progressed)

Keep the card visually small (≈ 80×120 px). Hover expands a
tooltip with full description.

## Tests

- Render with empty history + no current + no next: shows phase 1
  markers and an empty deck hint.
- Render mid-game with history.length = 5, a current card, a next
  card: all elements present.
- Render with current = boss: boss icon and threshold readout
  show.
- Phase markers display the right number of slots.

## Out of scope

- Threat resolve animation (3.3).
- Boss readout side-by-side comparison (3.5 — uses this strip but
  adds the side panel).
- Click interactions (3.6 wires "play tech that swaps the next
  card" UX).

## Done when

- TrackStrip is visible at the top of the Board in hot-seat play.
- Manually advancing the track via debug moves animates the strip
  through past / current / next correctly.
- All visual tokens come from `src/theme.ts`.
- `npm run lint` and component tests pass.
