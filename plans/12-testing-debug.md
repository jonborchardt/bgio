# 12 — Testing & debugging

## Goal

Continuous quality discipline. Not a one-time stage — milestones land
alongside other stages. This stub captures the *strategy* and tooling
milestones.

## Scope

**In:**
- **Layered tests:**
  1. Pure-logic unit tests (Vitest) — the bulk; one file per module.
  2. bgio headless-client tests — drive moves through the real engine; the
     pattern from [tests/game.test.ts](../tests/game.test.ts).
  3. React component tests (`@testing-library/react` + Vitest jsdom) —
     props in, DOM out.
  4. Multi-client integration tests (in-process server + two clients).
  5. Playwright e2e for hot-seat + (later) for two browsers against a real
     server.
- **bgio Debug panel** — surfaced via `client.debug` flag in dev builds
  only; kept off in production via env check.
- **Replay tools:**
  - Move log dumps to `localStorage` per match.
  - A `replay.tsx` route that reads a dumped log and steps through it.
- **CI:** a GitHub Actions workflow that runs `typecheck`, `lint`, `test`,
  RandomBot fuzz, and Playwright headless on every PR.
- **Coverage budget:** aim for 90%+ on pure-logic modules; UI coverage is
  not gated.

**Out:**
- Performance benchmarks. Add only when a real bottleneck is identified.

## Depends on

01 (test harness scaffold). All later stages add tests in their own
sub-plans; this stub adds tooling and the CI surface.

## Sub-plans

- `12.1-test-helpers.md` — shared test factories: `makeClient`,
  `seedGame`, `runMoves`, `assertConservation`.
- `12.2-debug-panel.md` — bgio Debug panel toggle + env gating.
- `12.3-replay.md` — move-log persistence + replay route.
- `12.4-ci-workflow.md` — `.github/workflows/ci.yml` running all gates.
- `12.5-playwright-setup.md` — `@playwright/test` config; first smoke
  spec hitting the dev server.
- `12.6-coverage-gate.md` — `vitest --coverage` with thresholds.
- `12.7-dev-full-stack.md` — one-command `npm run dev:full` that boots
  client + server + bots locally.

## Test surface (meta — what these tools verify)

- CI workflow blocks merges on any failure in lint / typecheck / unit /
  fuzz / smoke e2e.
- Replay route reproduces an arbitrary dumped game bit-for-bit.
- Coverage report excludes `*.tsx` files but includes every `*.ts` in
  `src/game/`, `src/engine/`, `src/data/`.
