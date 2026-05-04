# Sub-phase 3.5 — Boss thresholds readout

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10.6 + D21 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 3.1 merged. (Optional concurrency with 3.2 / 3.3 /
3.4.)

## Goal

When the boss is in the next-card slot of the track, show a
prominent panel comparing the village's current Science / Economy
/ Military totals against the boss's required thresholds. Players
should know whether they're prepared.

## Files touched

- `src/ui/track/BossReadout.tsx` (new).
- `src/ui/track/TrackStrip.tsx` — when next-card is the boss,
  render `<BossReadout>` adjacent (or in place of the next-card
  preview).
- `src/theme.ts` — token for "threshold met" (green-ish) vs
  "threshold not met" (warning).
- `tests/ui/track/BossReadout.spec.tsx` (new).

## Component shape

```tsx
interface BossReadoutProps {
  boss: BossCard;
  current: { science: number; economy: number; military: number };
}
```

Layout:

```
┌──────────────────────────────────────┐
│ BOSS — The Last Settlement           │
├──────────────────────────────────────┤
│ Science      6 / 6  ✓                │
│ Economy     12 / 14 ✗                │
│ Military     8 / 9  ✗                │
├──────────────────────────────────────┤
│ Attacks remaining:  4 - 1 = 3        │
│ Recommended: meet 1 more threshold   │
└──────────────────────────────────────┘
```

The "Attacks remaining" line shows the live computation:
`baseAttacks - thresholdsMet`. The recommendation line is a
heuristic ("meet 1 more threshold to drop to 2 attacks"); it's a
nice-to-have, can be cut if it complicates.

## Color coding

Use shape + color (not color alone — accessibility):

- ✓ icon + green tint when threshold is met.
- ✗ icon + amber/red tint when not.
- Numbers stay readable in both states.

## Live updates

The readout subscribes to the same `G` state the rest of the UI
sees. `current` totals are computed:

- Science: count of `science.grid` cards with `completed === true`.
- Economy: `G.bank.gold`.
- Military: sum of `unit.def.strength` over `G.defense.inPlay`,
  including taught skill effects.

These are pure derivations — compute in a React `useMemo` from
`G`.

## Tests

- All thresholds met: render shows three ✓ icons and "Attacks
  remaining: max(0, baseAttacks - 3)".
- Mixed: two ✓ and one ✗.
- None met: full base attacks.
- Boss not yet in next slot: component should NOT render (parent
  TrackStrip handles this).

## Out of scope

- Boss attack visualization (the standard path overlay from 3.3
  handles each attack).
- Win-screen reaction (separate end-game UI, not a Phase 3
  deliverable).

## Done when

- Player can see the boss readout when boss is next-up.
- Numbers update live as science completes / units gain strength
  / bank changes.
- Tests pass; visuals from `src/theme.ts`; accessibility checks
  green.
