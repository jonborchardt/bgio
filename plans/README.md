# /plans

High-level roadmap and per-stage plans for evolving this repo from the Card Sweep
starter into the cooperative post-apocalyptic settlement game described in
[../src/data/game-design.md](../src/data/game-design.md).

## How we plan

- **Top-down.** [00-roadmap.md](00-roadmap.md) names every top-level stage. Each
  stage has a stub file (`NN-<name>.md`) that lists the sub-plans we will write
  later. Sub-plans live in `NN-<name>/` subdirectories.
- **Driven by an execution playbook.** [EXECUTION.md](EXECUTION.md) describes
  how to actually drive the work — branch convention, parallel-agent
  claim/release protocol, stop/restart on token budget, commit message
  format, and the bgio-first verification gate. [STATUS.md](STATUS.md)
  is the live ledger of every sub-plan's state. Read both before
  implementing anything.
- **Granular.** A sub-plan covers one shippable change: pure logic + tests +
  (optionally) a UI piece. If a sub-plan is bigger than that, split it.
- **Modular.** Every module ships as: pure-logic file (headless, no React) +
  React view + JSON data (when applicable) + tests. bgio plumbing (phases,
  stages, plugins) composes modules; modules never reach into other modules'
  internals.
- **Test-first when practical.** Every sub-plan lists its unit tests up front.
  Headless tests use `Client` from `boardgame.io/client` (see
  [tests/game.test.ts](../tests/game.test.ts) for the pattern).
- **Data-driven.** Cards, units, buildings, techs, events live as JSON in
  [src/data/](../src/data/). Logic reads them; logic never hardcodes content.

## Stub format

Each top-level stub answers, briefly:

1. **Goal** — one sentence.
2. **Scope in / out** — what this stage owns and what it explicitly does not.
3. **Depends on** — which earlier stages must land first.
4. **Sub-plans** — bulleted list of the granular plans we will create.
5. **Test surface** — the kinds of tests this stage produces.

We do not write implementation detail in stubs — that is what sub-plans are for.

## Keeping CLAUDE.md current

[../CLAUDE.md](../CLAUDE.md) is loaded into every Claude session. When a
sub-plan changes a convention that future sessions need to know — module
layout, scripts, the no-fail-mode rule, the network-first stance — that
sub-plan is responsible for updating CLAUDE.md as part of its diff.
[01.5](01.5-claude-md-refresh.md) does the initial big refresh; later
sub-plans update it incrementally as needed.

## Naming

- `00-roadmap.md` — the master plan.
- `NN-<topic>.md` — top-level stage stub.
- `NN.M-<sub>.md` — sub-plan for that stage (flat, in `/plans` alongside its
  parent stub). E.g. `01.1-state-shape.md` is the first sub-plan of
  `01-foundations.md`.
- Numbers indicate suggested order, not strict dependency. The roadmap states
  the real dependencies.

## Working codename

The game has no canonical name yet — game-design.md just calls it the
settlement game. Stubs use **Settlement** as a placeholder. When the real name
lands, do a single rename pass across `/plans`, `index.html`, the README, and
`game.name` in `src/game.ts`.
