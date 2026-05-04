# Sub-phase 3.4 — Center-burn banner

**Parent:** [phase-3](./defense-redesign-phase-3.md)
**Spec refs:** §10.5 + §2 in [defense-redesign-spec.md](../reports/defense-redesign-spec.md)
**Predecessor:** 3.3 merged (path overlay shows the threat
reaching center; this banner reports the cost).

## Goal

When a threat reaches the center and burns from the pooled
stash, show a short floating banner that summarises the loss.
Players should be able to glance at it and know "we lost X
resources to this card."

## Files touched

- `src/ui/center/CenterBurnBanner.tsx` (new).
- `src/ui/center/CenterMat.tsx` (existing — small edit to host
  the banner).
- `src/game/bankLog.ts` — already emits `centerBurn` entries
  from 2.3; ensure the entry shape carries enough data
  (per-resource breakdown, per-seat breakdown).
- `src/theme.ts` — banner background / accent tokens.

## Banner design

```
[ -3 wood, -1 stone, -1 gold burned ]
[ to ⚔ Cyclone | round 14 ]
```

Two-line content. First line: per-resource summary (largest
first). Second line: which card caused it + round number for
audit traceability.

Banner appears for ~3 seconds, then fades. If multiple burns happen
in close succession (e.g. a boss with multiple attacks each
reaching center), the banner queues them or merges them with a
"+ 1 more burn" badge.

## Reading the source

The banner subscribes to `G.bankLog` (via React context or
`client.log` if it's surfaced there). It filters for entries with
`kind: 'centerBurn'` and tracks the latest unseen entry.

Alternative cleaner approach: attach the burn info to the same
`ResolveTrace` from 3.3, so the banner reads from `trace.centerBurned`
+ `trace.centerBurnDetail` on the most recent track-history entry.

Recommend the latter — keeps the resolve-event channel as the
single source of truth for the UI. `bankLog` is for audit /
chief-panel inspection, not for live UI animation.

## Tests

- A trace with `centerBurnDetail = { wood: 3, stone: 1, gold: 1 }`
  renders the right summary.
- Banner dismisses after the configured duration.
- Multiple burns in quick succession queue or collapse correctly.

## Out of scope

- Audit history view (chief panel). The bank log already supports
  it; no new UI here.
- Per-seat highlight ("seat 2 lost 1 wood" — the random
  distribution may want this, but defer to a polish pass).

## Done when

- A center-reaching threat triggers the banner with correct
  resource breakdown.
- Banner doesn't block interaction.
- All visuals from `src/theme.ts`.
- Tests pass.
