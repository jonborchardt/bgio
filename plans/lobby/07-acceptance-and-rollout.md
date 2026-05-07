# 07 — Acceptance, smoke, and Render → Cloud Run cutover

**Severity**: high (the only thing that proves the rest worked)
**Area**: ops / qa
**Effort**: small (manual smoke) → medium (automated networked smoke)
**Status**: not started
**Depends on**: plans 02, 03, 05, 06

## Files
- (new) `tests/e2e/networked-smoke.spec.ts` — automated multi-tab
  Playwright that hits the live Cloud Run URL.
- [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
  — add the smoke as a post-deploy gate (or run on a schedule).
- [render.yaml](../../render.yaml) and
  [.github/workflows/deploy-server.yml](../../.github/workflows/deploy-server.yml)
  — decide: keep, remove, or freeze.

## Problem
After plans 02–06 ship, three things must be true:

1. A real human (you) can open the live Pages URL on two devices,
   register / log in, create a match in tab A, join from tab B, and
   play one full round.
2. The live setup recovers from realistic disruptions (Cloud Run
   instance recycle on deploy, Pages refresh, browser close +
   reopen).
3. CI catches a regression in any of (server build, networked client
   build, deploy YAML, env wiring) before it reaches users.

Today only the first is testable — and only by hand.

## Manual smoke (the gate before declaring shipped)

Run all of these on the live Pages + Cloud Run combo. Each must pass.

### Cold open (new user, new device)

1. Browser A (clean profile): visit `https://YOUR-ORG.github.io/`.
2. Lobby renders → `<AuthForms>` shows.
3. Register username `alice` / password `password1234`. Should land
   on the lobby with "no matches yet".
4. Click "Create match" → choose 2 players, no solo mode → match
   appears in the list.
5. Click the match in the list, click seat 0 → networked client
   mounts, board shows.

### Second player joins

6. Browser B (different profile, ideally different network):
   visit the same Pages URL → register `bob` / `password1234`.
7. Match list shows the match created by `alice`. Click it, click
   seat 1.
8. **Both browsers should see the game start** (the chief phase
   begins automatically once all seats are full).
9. Play one full round: chief makes a move → others phase fires →
   end-of-round → round counter increments on **both** screens.

### Reconnect / restart

10. Browser A: close tab. Reopen, visit the Pages URL. Should
    automatically resume the match (creds in localStorage).
11. While the match is live, push a no-op deploy to Cloud Run
    (re-run the workflow). The revision rolls; both browsers should
    show a brief "Connecting…" spinner and then resume the same
    match. Match state persists per plan 03.

### Spectator path

12. Browser C (incognito, not logged in is fine — or different user).
    Click "Watch" on the running match. Board renders read-only;
    moves from A or B appear in real time.

### Negative paths

13. Browser A logs out (clear localStorage). Lobby auth gate appears.
    Match is still alive on the server; Bob (browser B) is unaffected.
14. Stop one of the bot seats (if any) — match continues.
15. Start a fresh match against 3 bots with `alice` solo. Round
    advances without other humans.

If all 15 pass, networked play is shippable.

## Automated smoke (longer-term)

The hot-seat smoke at [tests/e2e/smoke.spec.ts] currently boots `dist/`
locally. Networked smoke needs to:

- Spin up a local server (`npm run server:dev`) on a fresh
  `STORAGE_KIND=memory`.
- Build the client with `VITE_SERVER_URL=http://localhost:8000`.
- Open three Playwright contexts (alice, bob, watcher); register +
  join + drive one round; verify state on all three.

Issue 025 ("CI no networked e2e") already tracks this. Roll the work
into that issue rather than a new one — defer until the manual smoke
is stable.

A scheduled smoke against the **live** Cloud Run + Pages combo
(separate from CI; runs nightly) is also worth doing — but only
after the manual gate passes once.

## Render → Cloud Run cutover

Three choices, each defensible:

### A. Hard cut (recommended once manual smoke passes)
- Plan 02 ships `deploy-cloudrun.yml`.
- Plan 05 flips Pages to point at Cloud Run.
- Same PR removes [render.yaml](../../render.yaml) and
  [.github/workflows/deploy-server.yml](../../.github/workflows/deploy-server.yml).
- Decommission the Render service (delete via dashboard).
- Update [README.md](../../README.md) and
  [server/README.md](../../server/README.md) to describe Cloud Run.
  CLAUDE.md's "Deployment" section needs the same edit.

### B. Parallel (one release of safety)
- Plans 02 and 05 ship; Render keeps running.
- Pages builds twice — once at the Pages URL pointing at Cloud Run,
  once at a `pages-render` branch pointing at Render — and we use
  the latter as a fallback if Cloud Run misbehaves.
- After a week of clean runs, do A.
- Cost: a second Pages workflow + the Render free-tier service.
  Zero engineering risk.

### C. Keep Render, abandon Cloud Run
- Only if the user changes their mind on Cloud Run after seeing the
  cost / complexity story in plans 03/04.

## Acceptance

- All 15 manual smoke steps pass on the live Cloud Run + Pages.
- The chosen cutover (A / B / C) is documented in CLAUDE.md and the
  README.
- If A: `git grep -i 'render.com\|render.yaml\|render-flavored'` is
  empty in the working tree (or only references historical context
  in plan files).
- If B: a follow-up issue in `plans/` schedules the hard cut.

## Risks / open questions

- **Cloud Run cold start on the first user of the day** still
  exists at `minScale=1`? No — `minScale=1` keeps the instance warm.
  At `minScale=0` it's ~3–5s on gen2; manageable but worth measuring
  before lowering scale to save cost.
- **GH Pages CDN caches the bundle.** A deploy that changes
  `VITE_SERVER_URL` may take 5–10 minutes to propagate. The
  `<meta http-equiv="cache-control" content="no-cache">` tag is
  already in `index.html`; keep that honest.
- **Decommissioning Render too early.** Don't remove `render.yaml`
  in the same PR that adds Cloud Run — give yourself a release of
  parallel running unless you've already smoke-tested everything.
  Default is A but B is fine.

## Related

- 025 (CI no networked e2e) — automated smoke lands here.
- 02 / 05 — the things this plan validates.
- 03 (storage) — restart-survival check is the storage acceptance.
