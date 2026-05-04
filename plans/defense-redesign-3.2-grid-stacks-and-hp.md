# Sub-phase 3.2 — Domestic grid update: stacks, HP pips, center tile

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10.2, §10.4 + D13 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** Phase 2 fully merged. (Optional concurrency with
3.1.)

## Goal

Update the visual representation of the domestic grid so a player
can see:

- Each tile's HP (1–4 pips).
- The center tile, distinct from regular buildings.
- Units stacked on a tile, oldest at the bottom (D13: first-in,
  first-killed needs to be visually obvious).
- Recent damage / repair flashes.

## Files touched

- `src/ui/domestic/DomesticGrid.tsx` (existing — heavy edit).
- `src/ui/domestic/BuildingTile.tsx` (likely existing or new) —
  per-tile renderer with HP pips and unit stack.
- `src/ui/domestic/UnitStack.tsx` (new) — vertical stack
  visualizer.
- `src/ui/domestic/HpPips.tsx` (new) — 1–4 pip display.
- `src/ui/domestic/CenterTile.tsx` (new) — special render for
  `(0,0)`.
- `src/theme.ts` — palette tokens for HP states (full / damaged /
  critical) and center-tile accent.

## HP pips

```tsx
<HpPips current={hp} max={maxHp} />
```

- Filled pips for current HP, empty for missing.
- max 4 pips; with maxHp ≤ 4 (D15) this fits inline.
- Color states: full = `palette.status.healthy`, ≤50% =
  `palette.status.warning`, 1 = `palette.status.critical`.

Damage flash: when `hp` decreases between renders, briefly tint
the tile red (≤ 250 ms). Use a small framer-motion / mui transition.

Repair flash: when `hp` increases, tint green for the same
duration.

## Unit stack

```tsx
<UnitStack units={unitsOnTile} />
```

- Render units as small rectangles, vertically stacked.
- **Oldest unit at the bottom** (D13). First-placed renders at
  the visual base of the stack.
- Each rectangle shows the unit's name (or icon) + current HP.
- A drilled unit gets a small star/lightning icon overlay (3.6
  refines).
- Taught skills appear as a tiny tag row beneath the unit.

For stacks > 3, fall back to "show top 3 + a `+N more` badge."
The full list reveals on hover/click.

## Center tile

Distinct visual. Recommend:

- A larger circular footprint (occupies the same tile cell but
  rendered as a circle with a "Vault" label).
- Inset showing the live total of pooled non-chief stash
  (computed: sum of every non-chief seat's stash). This number is
  what threats are aiming at; players should see it at a glance.
- Center-burn animations land here in 3.4.

## Tests

- Render a tile with hp=4/4, hp=2/4, hp=1/4: pip count and color
  state are correct.
- Render a tile with 3 stacked units: bottom unit is the
  earliest-placed; "+N" appears for >3.
- Center tile renders with the live pooled-stash total.
- Damage flash plays when hp decreases (controlled with a state
  transition in the test).

## Out of scope

- Path overlay (3.3).
- Center-burn banner (3.4).
- Drill / teach indicators (full in 3.6 / 3.7).
- Tile click → place unit interactions (3.6).

## Done when

- Visual grid matches spec §10.2.
- Animations are short (≤ 250 ms) and don't block input.
- All colors come from `src/theme.ts`.
- Tests pass.
