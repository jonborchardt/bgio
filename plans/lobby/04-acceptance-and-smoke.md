# 04 — Acceptance + smoke against the live Render + Pages combo

**Severity**: high (the only thing that proves the rest worked)
**Area**: ops / qa
**Effort**: small (manual smoke) → medium (automated networked
smoke, deferred to issue 025)
**Status**: not started
**Depends on**: plans 02 + 03

## Files
- [tests/e2e/smoke.spec.ts](../../tests/e2e/smoke.spec.ts) — current
  hot-seat smoke; the networked variant lives next to it as
  `networked-smoke.spec.ts` when issue 025 lands.
- [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
  — could grow a post-deploy smoke gate later; not part of V1.

## Problem

After plans 02 and 03 ship, three things must be true:

1. A real human (you) can open the live Pages URL on two devices,
   register / log in, create a match in tab A, join from tab B,
   and play one full round.
2. The live setup recovers from realistic disruptions (Render
   restart on deploy, Pages refresh, browser close + reopen).
3. CI catches a regression in any of (server build, networked
   client build, deploy YAML, env wiring) before it reaches users.

Today only the first is testable — and only by hand.

## Manual smoke (the gate before declaring shipped)

Run all of these on the live Pages + Render combo. Each must pass.

### Cold open (new user, new device)

1. Browser A (clean profile): visit
   `https://YOUR-USER.github.io/<repo>/`.
2. Lobby renders → `<AuthForms>` shows.
3. Register username `alice` / password `password1234`. Should
   land on the lobby with "no matches yet".
4. Click "Create match" → choose 2 players, no solo mode → match
   appears in the list.
5. Click the match in the list, click seat 0 → networked client
   mounts, board shows.

### Second player joins

6. Browser B (different profile, ideally different network):
   visit the same Pages URL → register `bob` / `password1234`.
7. Match list shows the match created by `alice`. Click it,
   click seat 1.
8. **Both browsers should see the game start** (the chief phase
   begins automatically once all seats are full).
9. Play one full round: chief makes a move → others phase fires
   → end-of-round → round counter increments on **both** screens.

### Reconnect / restart

10. Browser A: close tab. Reopen, visit the Pages URL. Should
    automatically resume the match (creds in localStorage).
11. While the match is live, push a no-op deploy to Render
    (touch `server/...`, push to `main`). The service rebuilds
    and restarts; both browsers should show a brief
    "Connecting…" spinner and then resume the same match. Match
    state persists across the restart because SQLite lives on
    Render's persistent disk.

### Spectator path

12. Browser C (incognito, not logged in is fine — or different
    user). Click "Watch" on the running match. Board renders
    read-only; moves from A or B appear in real time.

### Negative paths

13. Browser A logs out (clear localStorage). Lobby auth gate
    appears. Match is still alive on the server; Bob (browser B)
    is unaffected.
14. Stop one of the bot seats (if any) — match continues.
15. Start a fresh match against 3 bots with `alice` solo. Round
    advances without other humans.

If all 15 pass, networked play is shippable.

### Quick CORS / proxy sanity (if anything in the manual smoke
trips on auth)

- DevTools Network panel: the `OPTIONS` preflight to
  `/auth/login` should return 204 with
  `access-control-allow-origin: https://YOUR-USER.github.io`.
  If it 403s or returns the wrong origin, plan 03's
  `ALLOWED_ORIGINS` is wrong on Render.
- Render service logs (`render logs settlement-server` or the
  Logs tab in the dashboard): auth attempts should show real
  client IPs, not Render's edge. If they all look like the
  same `35.x.x.x`, plan 03's `TRUST_PROXY` isn't set.

## Automated smoke (longer-term, deferred to issue 025)

The hot-seat smoke at [tests/e2e/smoke.spec.ts](../../tests/e2e/smoke.spec.ts)
currently boots `dist/` locally. Networked smoke needs to:

- Spin up a local server (`npm run server:dev`) on a fresh
  `STORAGE_KIND=memory`.
- Build the client with `VITE_SERVER_URL=http://localhost:8000`.
- Open three Playwright contexts (alice, bob, watcher); register
  + join + drive one round; verify state on all three.

Issue 025 ("CI no networked e2e") already tracks this. Roll the
work into that issue rather than a new one — defer until the
manual smoke is stable.

A scheduled smoke against the **live** Render + Pages combo
(separate from CI; runs nightly) is also worth doing — but only
after the manual gate passes once.

## Acceptance

- All 15 manual smoke steps pass on the live Render + Pages.
- A short note in the PR description (or a follow-up commit to
  CLAUDE.md) records the manual-smoke pass with the date so the
  "networked playtest is unverified end-to-end" caveat in
  CLAUDE.md can finally come down.

## Risks / open questions

- **Render free-tier sleep.** First request after ~15 min idle
  eats a ~30s cold start. The 10.6 reconnect spinner already
  covers this; just expect step 1 to be slow on a fresh visit.
- **GH Pages CDN caches the bundle.** A deploy that changes
  `VITE_SERVER_URL` may take 5–10 minutes to propagate. The
  `<meta http-equiv="cache-control" content="no-cache">` tag is
  already in `index.html`; keep that honest.
- **Two-network requirement.** Step 6 says "ideally different
  network". A single-network test is *probably* fine for V1
  (no NAT-traversal voodoo in SocketIO over HTTPS) but the
  failure mode "works on my LAN, breaks on cellular" is exactly
  the kind of thing we want to catch before declaring shipped.

## Related

- 025 (CI no networked e2e) — automated smoke lands here.
- 02 / 03 — the things this plan validates.
