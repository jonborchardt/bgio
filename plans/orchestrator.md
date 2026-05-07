# Plans Orchestrator — Settlement codebase review

This file indexes all open issues found in the 2026-05-06 codebase review and
recommends a fix order. Each issue lives in its own `issue-NNN-<slug>.md`. Open
those for full detail (problem, files, fix sketch, acceptance criteria,
related issues).

## Baseline at time of review

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — **1 failing**
  (`tests/ai/defenseBot.test.ts > prefers placements that cover the telegraphed next-threat path`),
  879 passing, **38 todo**

## Severity totals

- **Critical**: 2
- **High**: 9
- **Medium**: 24
- **Low**: 23
- **Total**: 58 distinct issues (some bundle 4-10 small polish items)

---

## Recommended fix order

The order optimizes for: (a) un-block the project's stated "primary delivery"
(networked play), (b) close the failing test and biggest-correctness bugs,
(c) clean up drift that's actively misleading, (d) hardening + polish.

### Tier 0 — Networked deploy is currently unsafe (do these first)

These three are the minimum to call the networked build deployable. They also
unlock the rest of the server work.

| # | Title | Sev |
|---|---|---|
| [001](issue-001-render-yaml-missing.md) | `render.yaml` missing entirely | critical |
| [002](issue-002-match-moves-not-authenticated.md) | Match moves not authenticated against accounts (no `authenticateCredentials` hook) | critical |
| [003](issue-003-bgio-server-missing-bots-config.md) | bgio `Server` constructed without `bots` config | high |

### Tier 1 — Failing test + biggest correctness bugs

| # | Title | Sev |
|---|---|---|
| [005](issue-005-defense-bot-path-coverage-bug.md) | Defense bot does not weight by next-threat path (failing test) | high |
| [009](issue-009-resolve-threat-trace-path-duplication.md) | `resolveThreat` duplicates path entries when threat reaches center | high |
| [004](issue-004-sciencebot-is-a-stub.md) | `scienceBot` is a stub returning `null` | high |
| [006](issue-006-cors-origins-missing.md) | Server missing `origins` (CORS) configuration | high |
| [011](issue-011-cell-slot-not-keyboard-activatable.md) | `<Box role="button">` cells not keyboard-activatable (a11y regression on village grid) | high |

### Tier 2 — Hard-rule violations + persistence gap

| # | Title | Sev |
|---|---|---|
| [010](issue-010-theme-tint-tokens-vs-hex-rgba-literals.md) | Hex-alpha + rgba literals violate "no hex outside theme.ts" hard rule | high |
| [007](issue-007-runs-persistence-in-memory.md) | Run-history persistence still in-memory (migration 002 unwired) | high |
| we are skipping 008 till later: [008](issue-008-library-content-overshoots-target.md) | Library content over-shoots (282 cards vs 60 target) — boss debuff trivial | high |

### Tier 3 — Drift, dead code, schema cleanup

These are not breaking anything today but actively mislead readers and lock in
unused content. Address in a single sweep PR or split as needed.

| # | Title | Sev |
|---|---|---|
| [013](issue-013-schema-cleanup-stale-fields.md) | Schema cleanup (stale `altStats`/`initiative`, `BossThresholds` comment, `foreign*` refs, `BENEFIT_TOKENS`, `ScienceColor` dup) | medium |
| [014](issue-014-center-mat-vestigial.md) | `CenterMat` vestigial empty interface | low |
| [018](issue-018-doc-drift-cleanup.md) | Doc drift: README + CLAUDE.md vs reality (chat/, library/, SCIENCE_CARDS, ...) | medium |
| [012](issue-012-requests-system-status-decision.md) | `src/game/requests/` undocumented — decide retire-or-document | medium |
| [021](issue-021-dead-ui-directories.md) | Dead UI directories from prior redesigns | medium |
| [015](issue-015-data-index-missing-reexports.md) | `src/data/index.ts` missing `EVENT_CARDS` / `ADJACENCY_RULES` re-exports | medium |
| [016](issue-016-eslint-no-direct-json-import.md) | ESLint missing the "no direct .json import" rule | medium |
| [043](issue-043-tsx-devdep-obsolete.md) | `tsx` devDep obsolete; remove | low |

### Tier 4 — Server / infra hardening

| # | Title | Sev |
|---|---|---|
| [022](issue-022-sqlite-migrations-no-version-table.md) | SQLite migrations have no version table; SQL files re-run every boot | medium |
| [023](issue-023-auth-rate-limit-unbounded.md) | Auth rate-limit unbounded map + global to process + proxy IP collapse | medium |
| [024](issue-024-deploy-server-yml-no-tests.md) | `deploy-server.yml` doesn't run unit/lint tests | medium |
| [044](issue-044-server-tsconfig-missing-start.md) | `server/tsconfig.json` missing `start.ts` from include | medium |
| [045](issue-045-dockerfile-healthcheck-non-root.md) | Dockerfile lacks `HEALTHCHECK` and runs as root | medium |
| [050](issue-050-env-example-missing.md) | `.env.example` missing; SQLite path drift | low |
| [048](issue-048-npm-script-aliasing.md) | `dev:server` / `server:dev` / `server:start` script duplication | low |
| [049](issue-049-dev-seed-only-in-memory.md) | `dev-seed.ts` only seeds in-memory accounts store | low |
| [051](issue-051-tests-e2e-excluded-from-lint.md) | `tests-e2e/` excluded from lint | low |
| [052](issue-052-auth-verify-dead-cookie-path.md) | Auth `verify` rotates tokens but doesn't issue HTTP-only cookie; dead cookie path | low |
| [053](issue-053-idle-watcher-grant-leak.md) | Idle watcher grant Map never trimmed | low |
| [054](issue-054-bgio-storage-log-grows-unbounded.md) | bgio adapter `log` table grows unbounded per match | low |
| [055](issue-055-tsconfig-app-server-cross-import.md) | `tsconfig.app.json` excludes `server/` but tests cross-import | low |

### Tier 5 — Test coverage

| # | Title | Sev |
|---|---|---|
| [029](issue-029-it-todo-coverage-gaps.md) | 38 `it.todo` tests cluster around real coverage gaps | medium |
| [030](issue-030-engine-test-gaps.md) | Engine test gaps: `bankLog`/`economyHigh`, `centerBurn`, `computeRunScore`, hook ordering | medium |
| [031](issue-031-randombot-fuzz-omits-defense-events.md) | RandomBot fuzz harness omits Defense recruits / event plays | medium |
| [032](issue-032-boss-winrate-test-misleading.md) | Boss winRate test forces `seatDone` — doesn't exercise real bots | medium |
| [025](issue-025-ci-no-networked-e2e.md) | CI smoke only hot-seat; no networked end-to-end test | medium |
| [033](issue-033-mcts-dynamic-playout-missing.md) | MCTSBot dynamic playout missing | medium |
| [034](issue-034-replay-determinism-coverage.md) | Replay-driver determinism coverage gap | medium |
| [036](issue-036-chiefbot-doesnt-use-tax.md) | `chiefBot` never selects the new Tax super-power | medium |
| [037](issue-037-defensebot-test-hardcoded-seat.md) | `defenseBot.test.ts` hard-codes seat `'3'` instead of `seatOfRole` | low |

### Tier 6 — Engine correctness follow-ups

| # | Title | Sev |
|---|---|---|
| [038](issue-038-end-of-round-counter-timing.md) | `endOfRound.onBegin` round-counter timing edge case | medium |
| [039](issue-039-centerburn-skews-bank-view.md) | `centerBurn` audit log skews `computeBankView` per-round split | medium |
| [040](issue-040-playerview-nexthands-redaction.md) | `playerView` may not redact every seat in `nextHands[color]` | medium |
| [041](issue-041-cross-role-imports.md) | Cross-role imports for engine lookup tables | low |
| [042](issue-042-setup-random-fallback-masks-bugs.md) | Random fallback in `setup.ts` masks missing-plugin bugs | low-medium |
| [035](issue-035-defense-bot-composed-play-picks-first.md) | Defense bot composed `play()` picks first candidate (downstream of #5) | medium |

### Tier 7 — Content depth

| # | Title | Sev |
|---|---|---|
| we are skipping 019 till later: [019](issue-019-tech-content-onplay-effects-coverage.md) | Only 3 of 132 techs have `onPlayEffects` | medium |
| we are skipping 020 till later: [020](issue-020-events-library-tagging-coverage.md) | Only ~4 of 16 events carry library tagging | medium |
| we are skipping 017 till later: [017](issue-017-trackcards-no-modifier-cards.md) | `trackCards.json` ships zero `modifier` cards despite Rules.md describing the trio | medium |

### Tier 8 — UI perf + small ergonomics

| # | Title | Sev |
|---|---|---|
| [026](issue-026-cardinfo-context-rebuilt-every-render.md) | `CardInfoProvider` context value rebuilt every render | medium |
| [027](issue-027-hand-place-button-canact.md) | Domestic Hand's Place button doesn't gate on `canAct` | medium |
| [028](issue-028-relationships-modal-host-rerenders.md) | `RelationshipsModalHost` re-renders entire graph on every `G` change | medium |

### Tier 9 — Repo hygiene + bundled polish

| # | Title | Sev |
|---|---|---|
| [046](issue-046-card-decks-untracked.md) | `card-decks/` untracked with no `.gitignore` entry | low |
| we are skipping 047 till later: [047](issue-047-screenshots-at-repo-root.md) | Stale screenshots at repo root | low |
| [056](issue-056-misc-game-polish.md) | Misc game / engine polish (bundle of 11 small items) | low |
| [057](issue-057-misc-ui-polish.md) | Misc UI polish (bundle of 8 small items) | low |
| [058](issue-058-misc-tunable-and-balance.md) | Misc tunable / balance / Rules.md notes (bundle of 4 items) | low |

---

## Dependency / sequencing notes

- **001 → 002 → 003** is the hard chain for networked-deploy readiness. Don't
  merge any of them in isolation: render.yaml without auth = open server;
  auth without bots config = humans needed for every seat.
- **004 (scienceBot) → 032 (boss winRate test)**: the test only becomes
  meaningful with a real bot.
- **005 (defense bot bug) → 035 (composed play picks first)**: 035 may
  auto-resolve after 005.
- **008 (content rebalance) → 017 / 019 / 020**: do them in the same content
  pass.
- **022 (migrations versioning) → 007 (runs store)**: persistence work needs
  proper migrations first.
- **010 (theme tokens) → 057 (misc UI polish)**: token additions land first,
  then call-site sweep.
- **003 (bots) + 004 (scienceBot) + 005 (defenseBot) → 029 Group B
  (server idle test it.todos)**: server bot-takeover tests need real bots to
  exercise.

## How to use this orchestrator

1. Pick the highest-tier open issue you can reasonably tackle.
2. Open its `issue-NNN-*.md` for the full problem + fix sketch + acceptance.
3. After landing, mark the **Status** at the top of the issue file as
   `in progress` / `done`, and move the entry to a "Done" section at the bottom
   of this orchestrator (or delete it).
4. New findings: add as `issue-059-*.md` etc., and slot into the appropriate
   tier here.

## Out of scope for this review (not investigated in depth)

- Visual / UX design quality (only structural a11y and theme rule compliance).
- Game balance numbers (only flagged the obvious "boss too easy" trio of
  thresholds + content count + library debuff math).
- Mobile / touch input (assumed desktop-only for V1).
- I18n / localization (no translation infrastructure in repo today).
- Telemetry / analytics.
