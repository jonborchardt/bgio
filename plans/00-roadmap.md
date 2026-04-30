# Roadmap

The full path from Card Sweep starter to the cooperative settlement game.

## Guiding principles

1. **bgio is the engine; modules are the content.** Each role, the resource
   system, the opponent, etc. is a self-contained module that exposes pure
   reducers and (optionally) bgio phase/stage definitions. The top-level
   `Game` object is a thin composer.
2. **Pure logic first, UI second.** Every gameplay rule is testable headlessly
   before it gets a React view.
3. **Data lives in JSON.** Logic must accept content as input. No `if (card.name === "Foo")` in code — branch on data attributes.
4. **One sub-plan = one PR-sized change.** If a sub-plan needs more than ~150
   lines of new code or touches more than ~3 modules, split it.
5. **Networked is the primary delivery mode.** Hot-seat keeps working as a
   dev shortcut and as the GH Pages fallback, but the canonical experience
   is browsers connected to the bgio server. Stages 10 and 13 are
   first-class, not afterthoughts. Don't paint ourselves into a hot-seat
   corner — never assume same-process state outside the engine itself.
6. **Default game shape: 4 players, 3 of them bots.** When the user boots
   the app with no other config, they get a 4-seat game where they hold one
   role and bots cover the other three. Solo mode (11.7) reshapes this for
   a 2-player feel.
7. **No fail mode, but a hard turn cap.** The game has one win condition
   (10 settlements joined) and one stop condition (turn 80 reached). The
   stop condition is *not* punishing — it ends the run and records turn
   count + settlements joined to the server, so the next run can aim
   higher. A "bad" run just takes longer or runs out of time. Plans must
   not invent creeping-doom failure states.
8. **Accounts are part of V1.** Win records and run history live in the
   server SQLite DB, keyed to a logged-in user. Anonymous play exists
   (the GH Pages hot-seat demo), but the canonical experience requires
   login.

## Execution

This roadmap names *what* to build. [EXECUTION.md](EXECUTION.md) tells
you *how*: branch per sub-plan, one commit per sub-plan, claim a row in
[STATUS.md](STATUS.md) before working on it, bgio-first verification
before merging. Read both before implementing anything.

## Top-level stages

Numbered for suggested order. Real dependencies are in each stub's
**Depends on** section.

| #  | Stage | What it owns |
|----|-------|--------------|
| 01 | [Foundations](01-foundations.md) | Project skeleton replacing Card Sweep — state types, data loaders, naming, headless test harness |
| 02 | [Engine](02-engine.md) | bgio phases, stages, turn order, events, randomness, secret state — the round skeleton |
| 03 | [Resources](03-resources.md) | Tokens, the bank, the center mat (per-player circles, trade-request slot) |
| 04 | [Role: Chief](04-chief.md) | Distribution, optional worker placement, gold event card |
| 05 | [Role: Science](05-science.md) | Card grid, requirement check, completion, tech-card distribution |
| 06 | [Role: Domestic](06-domestic.md) | Building hand, in-play grid (adjacency optional), buy / upgrade / produce |
| 07 | [Role: Foreign](07-foreign.md) | Units, recruit, upkeep / release, deterministic battle, trade requests |
| 08 | [Cross-cutting](08-cross-cutting.md) | Per-color event decks, opponent (wander), tech-card content, win condition + 80-turn cap |
| 09 | [UI](09-ui.md) | Per-role panels, center mat, card components, MUI theming pass |
| 10 | [Multiplayer infra](10-multiplayer.md) | Lobby, server, transport, storage, chat, accounts, spectators |
| 11 | [AI / bots](11-ai.md) | Random + heuristic bots per role, solo mode |
| 12 | [Testing & debugging](12-testing-debug.md) | Test layering, bgio Debug panel, replay tools, CI |
| 13 | [Deployment & persistence](13-deploy.md) | GitHub Pages (hot-seat) + a server target for networked play |

## Dependency shape

```
01 Foundations
   └─> 02 Engine
        └─> 03 Resources
             ├─> 04 Chief ─┐
             ├─> 05 Science ┤
             ├─> 06 Domestic ┼─> 08 Cross-cutting ─> 09 UI ─┐
             └─> 07 Foreign ─┘                              │
                                                            ├─> 13 Deploy
                              10 Multiplayer infra ─────────┤
                              11 AI / bots ─────────────────┤
                              12 Testing & debugging (continuous, started at 01)
```

12 (Testing & debugging) is not a phase — it is a cross-cutting concern that
starts with stage 01 and grows alongside everything else. The stub captures
strategy and tooling milestones rather than a sequenced workstream.

## Sequencing notes

- **Stages 04–07 can land in any order.** They share the resource layer (03)
  and the engine skeleton (02), but they do not depend on each other. We can
  ship Domestic and Foreign in parallel once 03 is done.
- **Cross-cutting (08) needs at least one role landed.** Event cards, opponent
  pressure, and win conditions only make sense once a role can use them.
- **UI (09) starts in lockstep with each role.** The stub captures the
  layout and theming pass; per-role panels actually grow inside the role
  stubs (each role has a "render it" sub-plan).
- **Multiplayer (10) is independent of gameplay stages.** It can be built any
  time after 02. We do not gate gameplay on it, but it is the *primary*
  delivery — start it as soon as foundations + engine are in.
- **AI (11) needs the role moves it drives.** Random bots can land as soon
  as 02 + 03 exist; heuristic bots need their target role finished.
- **Deployment (13).** Networked deploy (Render) is the headline target.
  Hot-seat GH Pages stays alive as a fallback / link-and-share demo path.

## Definition of done per stage

A top-level stage is "done" when:

- All its sub-plans are merged.
- Its public surface (types + bgio definitions) is exported from a single
  module barrel.
- Headless tests cover the success path and at least one invalid-move path
  per move.
- `npm run typecheck && npm run lint && npm test` is green.
- The stage is mentioned in the README's "what works" list.
- [../CLAUDE.md](../CLAUDE.md) reflects any new convention introduced by
  this stage. If nothing changed, no edit needed; if module layout,
  scripts, or working rules shifted, update before merging.

## What we are explicitly NOT doing in this roadmap

- Designing expansions (5–6 player counts, alt-faction tech trees).
- Picking the canonical option for the Science / Domestic / Foreign mechanics
  beyond a default. Each role stub starts with the simplest option (1) and
  treats the others as future sub-plans we may or may not pick up.
- Picking the deployment host for the multiplayer server. That is a
  sub-plan inside stage 13 once we know how heavy server-side state gets.
