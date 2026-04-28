# 08 — Cross-cutting: events, opponent, win / lose

## Goal

Wire the gameplay layers that touch every role: per-color event card decks,
the opponent pressure system, and the win / lose conditions.

## Scope

**In:**
- **Event decks** (game-design.md §Events, §General Play "may play 1 event"):
  - Four per-color decks (gold, blue, green, red) of 4 starter cards each.
  - "Choose one each cycle" rule: each player picks one of 4 unseen events
    each round; once all 4 picked, the pool re-opens. Track per-player
    event-cycle state.
  - Event effect dispatcher — events are data with typed effect tags
    (e.g. `{type: 'doubleScience'}`, `{type: 'forbidBuy'}`, …). Effects
    apply at well-defined hook points (start-of-phase, on-purchase, etc.).
- **Opponent** (game-design.md §Opponent):
  - Default to **Option 1** (Wander deck of 24 cards with bonuses / hurts).
  - Apply a wander card at `endOfRound` via the round-end hook from 02.
  - Boss / growing-stats variant (Option 2) reserved as a sub-plan.
- **Win / lose**:
  - Track `settlementsJoined` counter; +1 each time a battle is won as
    "join" or trade succeeds as "tribute".
  - Win at `settlementsJoined >= 10`.
  - **No lose condition.** A bad run just takes longer; the meta-goal
    is "win faster next time". Track turn count on completion so future
    runs can compare.

**Out:**
- Specific event card content beyond a starter set. Treat the JSON file
  added here as living content.
- Boss / wander deck content design — only the engine plumbing.

## Depends on

01, 02, 03, plus at least one of 04–07 landing so events have something to
modify.

## Sub-plans

- [08.1-event-deck-shape.md](08.1-event-deck-shape.md) — `events.json`
  schema + loader + per-player event-cycle state.
- [08.2-event-dispatcher.md](08.2-event-dispatcher.md) — typed effect
  registry + the hook points where effects fire.
- [08.3-event-moves.md](08.3-event-moves.md) — flesh out the four
  `*PlayXEvent` placeholder moves from each role stub.
- [08.4-wander-deck.md](08.4-wander-deck.md) — opponent deck + round-end
  application.
- [08.5-end-conditions.md](08.5-end-conditions.md) — `endIf` win-only;
  settlement counter; turn-count tracking for "win faster next time".
- [08.6-tech-card-content.md](08.6-tech-card-content.md) — initial AI-assisted
  content pass for tech cards (effects on each role's hand owner).

## Test surface

- Event-cycle invariant: a player never plays the same event twice within
  one cycle of 4 picks.
- Each effect tag has at least one positive and one negative test.
- Wander effects apply once per round, not per phase.
- `endIf` returns the correct outcome for: 10 settlements (win), forced
  upkeep failure (lose), and ongoing game (undefined).
