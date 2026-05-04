# Sub-phase 3.6 — Defense panel rewrite

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §9, §10.7, D23, D24 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** Phase 2 fully merged + 3.1 + 3.2 (so the panel
can reference the new track and grid components).

## Goal

Replace the post-1.4 defense stub panel with the real Defense UI:
a hand of unit cards, a buy-and-place flow, a tech-card row, and
the in-play units summary with drill / teach indicators.

## Files touched

- `src/ui/defense/DefensePanel.tsx` (new — replaces stub).
- `src/ui/defense/UnitHand.tsx` (new) — card row.
- `src/ui/defense/UnitCard.tsx` (new) — single unit display.
- `src/ui/defense/PlacementOverlay.tsx` (new) — clickable tile
  picker on the grid.
- `src/ui/defense/TechRow.tsx` (new) — red tech hand.
- `src/ui/defense/InPlayList.tsx` (new) — sidebar listing of
  recruited units, with skills + drill markers.
- `src/theme.ts` — defense accent already exists
  (`palette.role.defense` — reuse).

## DefensePanel layout

```
┌─────────────────────────────────────┐
│ DEFENSE — your turn                 │
├─────────────────────────────────────┤
│ Stash: 3 gold, 2 wood…              │
│ Next track card: Cyclone (N, +2, 5) │
├─────────────────────────────────────┤
│ Hand                                │
│ [Spearman] [Sapper] [Watchman]…    │
├─────────────────────────────────────┤
│ Tech                                │
│ [Reinforce II] [Peek 2] [Demote]    │
├─────────────────────────────────────┤
│ In play (4)                         │
│ Spearman on Tower(1,0) — hp 2/3     │
│   ★ drilled                         │
│   skills: extendRange               │
│ Sapper on Well(1,1) — hp 1/1        │
│ ...                                 │
├─────────────────────────────────────┤
│ [End my turn]                       │
└─────────────────────────────────────┘
```

## Buy + place flow

1. Click a unit card in the hand.
2. Card highlights; the domestic grid switches into
   "placement mode" (PlacementOverlay) — every legal target tile
   (non-center, has a building) glows.
3. Click a tile to confirm; dispatches
   `defenseBuyAndPlace(unitDefID, cellKey)`.
4. Placement-mode highlight clears.
5. The new unit appears at the top of the visual stack on that
   tile (oldest stays at bottom — D13).

Cancel: click the unit card again, or press Esc.

## Tech play flow

1. Click a tech card in TechRow.
2. If it targets a unit (unit-upgrade tech), the in-play list
   highlights selectable units. Click to confirm.
3. If it manipulates the track (peek N / swap / demote), the
   TrackStrip flashes a hint and the action dispatches
   immediately.

## Indicators

- **Drill indicator**: small lightning icon next to a unit's name
  in InPlayList AND on the unit's stack rectangle in the grid.
- **Taught skills**: tag chips on the unit's row in InPlayList
  (e.g. `[range +1]`, `[regen +1]`).
- **Telegraphed next-card hint**: a small inset showing what's
  coming, so the defense player can plan without scrolling up to
  the TrackStrip.

## Tests

- Hand renders all unit cards from `G.defense.hand`.
- Click → placement mode → click tile → dispatches the move.
- Cancel placement clears state.
- Tech card with unit target opens unit picker.
- In-play list reflects taught skills + drill markers.
- "End my turn" disabled if there are unfinished interactions
  (optional polish — not required).

## Out of scope

- Sophisticated UX for combo-tech selections (the V1 effects are
  simple).
- Multi-step undo (bgio's UNDO is blocked under setActivePlayers
  anyway).

## Done when

- Defense seat is fully playable end-to-end via mouse in hot-seat.
- All moves dispatch correctly; no console errors.
- Stylings come from `palette.role.defense` and other theme
  tokens.
- Tests pass.
