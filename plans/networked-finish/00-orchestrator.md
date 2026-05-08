# Networked finish — get the live game working as expected

This subdirectory is the followup to `plans/lobby/`. The lobby plan
got us a deployed bgio server on Render + a networked Pages bundle
that talks to it. Two humans can register, create a match, and play
real-time. Solo mode (one human + bots) almost works after PR #12,
with PR #13 closing the seat-takeover edge case.

But several real UX gaps remain that the lobby plan deliberately
deferred. After implementing the items here, the live deploy will
behave the way a player expects — not "intentionally not working" —
and the user can iterate from there on polish + features.

## Scope

What "working as expected" means for V1:

- **Cold-start recovery.** When the Render container recycles (deploy,
  idle wake, restart), users with stale creds in localStorage don't
  see infinite "connecting…" — they get bounced cleanly to login.
- **Connection failure UI.** The bgio Client's default `connecting…`
  loading text doesn't sit forever when something goes wrong. There's
  a timeout, an error, and a manual retry.
- **Persistent accounts + matches across cold starts.** Either we
  upgrade Render to Starter ($7/mo) for SQLite-on-disk, or we accept
  that everything wipes and document it loudly. Plan 03 covers the
  decision and the four-line `render.yaml` flip.
- **A way to play with N humans + M bots in the same match.** Today
  the lobby is binary: Solo (all bots except one) or non-solo (all
  humans). For a 4p playtest with 2 humans + 2 bots, neither works.
- **Validated end-to-end smoke.** The 16-step manual smoke from
  `plans/lobby/04-acceptance-and-smoke.md` runs cleanly on the live
  combo.

What's explicitly OUT of scope here (post-V1):
- Multi-instance scaling (Redis adapter, single-leader timers).
- Custom domain in front of Render.
- Match search / friends / private matches.
- Replacing `LobbyShell` with bgio's stock `<Lobby>`.
- Per-player chat ("Bob took over for Alice" type system messages).

## Index

| # | File | What it adds | Effort |
|---|---|---|---|
| 01 | [stale-creds](01-stale-creds.md) | Probe `/auth/verify` on networked-mount; if 401, clear creds → lobby | small |
| 02 | [connection-recovery](02-connection-recovery.md) | Replace bgio's `connecting…` with our own timeout/retry shell | small-medium |
| 03 | [persistence](03-persistence.md) | Flip `render.yaml` to Starter + SQLite + persistent disk (or document the in-memory tradeoff) | tiny + $7/mo |
| 04 | [fill-empty-with-bots](04-fill-empty-with-bots.md) | "Start with bots in empty seats" affordance — 2 humans + 2 bots becomes expressible | small |
| 05 | [acceptance](05-acceptance.md) | Run the manual smoke; consider the automated networked smoke from issue 025 | smoke + (deferrable) | 

## Recommended order

1. **Merge PR #13** (already filed) — closes the immediate "second player stuck on connecting…" bug. Pre-condition for any solo testing.
2. **Plan 01 (stale-creds)** — fixes the second most common stuck state. Without this, every Render cold-start orphans the user. Small client patch, no server change.
3. **Plan 03 (persistence)** — the decision is binary and the implementation is one file edit. If you opt for Starter, do it now so plan 05's smoke can include the "restart resilience" check honestly.
4. **Plan 02 (connection-recovery)** — once 01 + 03 land, the remaining "stuck on connecting…" cases are real connection issues (transient network, etc.). Surface them with timeout + retry.
5. **Plan 04 (fill-empty-with-bots)** — enables 2-humans + bots playtest scenarios. Required for any meaningful 4-player testing without recruiting 4 humans.
6. **Plan 05 (acceptance)** — smoke the live combo. Closes the loop and lets you remove the "networked playtest unverified" caveat from CLAUDE.md.

01–04 are independent (touch different files) and can land in any order. 05 only meaningful after 01–04.

## Decisions to confirm before starting

- **Persistence path** (plan 03 default). Starter tier ($7/mo) + SQLite + persistent disk → accounts and matches survive restarts. Free tier + in-memory → everything wipes on every cold start (~ every 15 min idle). Default in this plan: pay for Starter. Override if you want to keep the free-tier playtest going for now.
- **Connection-recovery affordance** (plan 02). The 10.6 plan called for retry intervals 1s / 2s / 5s / 15s / 30s / 60s with a manual "retry now" button. Default in this plan: implement that exactly. Cheaper alternative is just a 30s timeout + reload button.
- **Fill-empty-with-bots wiring** (plan 04). Two implementation paths: (a) lobby UI button "fill bots now" that hits an internal endpoint, or (b) auto-fill after N seconds when match has been created but seats are empty. Default in this plan: (a) — explicit user opt-in, cleaner mental model.

## Out of scope, noted for honesty

These were called out in earlier sessions; they're not in this plan
but should not be lost:

- **Multi-instance scaling.** Render free tier is single-instance.
  When/if we go to a paid plan with `>1` instances, the SocketIO
  room map needs a Redis adapter, and the in-process timers
  (botDriver, idleWatcher, log compaction) need a single-leader
  story (cron-driven from Cloud Scheduler, or a distributed lock).
- **Logout button.** There's leave-match (PR #11) and there's
  logout — not the same. Logout would clear the auth token and
  return to AuthForms. Trivial to add (~5 lines), not strictly
  required for "game works as expected".
- **Solo seat-picker coupling.** When `soloMode=true, humanRole='chief'`
  is set in setupData, the seat picker still lets the user pick a
  non-chief seat. That'd land them in a seat that's also flagged
  as a bot, which is a confusing state. Either auto-pick the
  humanRole's seat post-create, or remove humanRole from the form
  and infer it from whichever seat the user picks. Out of scope
  here — the create-match form is OK to clean up later.
- **Automated networked smoke in CI** (issue 025). Plan 05 mentions
  it as a deferrable. Real implementation is its own plan.
- **Match cleanup / TTL.** With persistent storage (Starter tier),
  abandoned matches accumulate forever. Need a sweep that drops
  matches with `gameover` set or last-activity > N days. Post-V1.
- **bgio Server `gameMetadata` prop wiring.** bgio's `Server` accepts
  a `gameOverHook` and similar that we don't currently use. Could
  drive automatic match cleanup post-game. Post-V1.

## Related

- `plans/lobby/` — the parent plan that got us this far.
- `plans/lobby/04-acceptance-and-smoke.md` — the smoke walkthrough
  plan 05 references.
- Open issues (in `plans/`):
  - issue 025 — automated networked smoke in CI.
  - issue 022 — SQLite migration version table (relevant when
    plan 03 picks Starter + SQLite).
  - issue 007 — runs persistence (closed in code; same DB story
    as plan 03).
