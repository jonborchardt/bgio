# 02 — GitHub Pages publishes the networked client pointed at Render

**Severity**: high (without this, "users hit my client via GitHub"
still gets the hot-seat build with no server)
**Area**: client / build / CI
**Effort**: small
**Status**: not started
**Depends on**: plan 03 in the same PR (CORS env). Don't merge this
ahead of plan 03 or the live Pages site will load but every
auth/lobby request will fail CORS.

## Files
- [.github/workflows/deploy-pages.yml:34-39](../../.github/workflows/deploy-pages.yml)
  — flip `npm run build:hotseat` → `npm run build:networked` and
  pass `VITE_SERVER_URL`.
- [scripts/build-networked.mjs](../../scripts/build-networked.mjs) —
  already reads `process.env.VITE_SERVER_URL`. No change needed.
- [src/clientMode.ts:50-52](../../src/clientMode.ts) — already reads
  `VITE_SERVER_URL` (with localhost fallback). No change needed.
- [src/App.tsx](../../src/App.tsx) — already routes to `LobbyShell`
  in networked mode. No change needed.

## Problem

The Pages build today is the demo / fallback hot-seat single-tab
experience. The whole point of the networked rollout is that anyone
hitting the published Pages URL should land on the lobby, log in,
matchmake on the Render server, and play with other people. That
requires the Pages workflow to build in networked mode and bake the
Render URL into the bundle.

## Fix sketch

### Default approach: single networked Pages build

One build, points at Render, no runtime mode toggle.

1. Add a repo-level GitHub Actions **variable** (not secret — it
   ends up in the bundle verbatim) named `VITE_SERVER_URL` with the
   Render service URL — typically
   `https://settlement-server.onrender.com` (verify from the Render
   dashboard before setting; Render sometimes appends a hash to the
   service-name slug).
2. Edit [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
   build step:
   ```yaml
   - name: Build (networked, Render)
     env:
       VITE_SERVER_URL: ${{ vars.VITE_SERVER_URL }}
     run: npm run build:networked
   ```
   `scripts/build-networked.mjs` already exports
   `VITE_CLIENT_MODE=networked` and forwards `VITE_SERVER_URL`.
3. The `base: './'` Vite config keeps the build portable to
   whatever Pages URL hosts it.
4. **First run gating**: the current workflow auto-runs on every
   push to `main`. To avoid flipping the live Pages site to a
   networked build before plan 03 has set CORS env on Render,
   either (a) land plans 02 and 03 in the same PR and accept the
   first push as the cutover, or (b) temporarily restrict the
   workflow to `workflow_dispatch` only, smoke it manually, then
   re-enable the push trigger in a follow-up. Default: (a). Plan 04
   ships the manual smoke that immediately follows the merge.

### Hot-seat doesn't disappear (pick one)

- **Drop it.** Hot-seat was the demo path; with networked live, no
  one needs it on Pages. Designers can `npm run dev` locally.
  Smallest delta. **Default.**
- **Hash route.** [App.tsx:234-256](../../src/App.tsx) already
  supports `#cards`, `#mats`, `#boards`, `#fuzz`. Add `#hotseat`
  that mounts `<HotSeatShell>` regardless of `detectMode()`. One
  networked build, but `https://<pages>/#hotseat` is a fallback for
  any human who wants to drive all four seats from one tab.
  Cheapest "still has hot-seat" option; ~10 lines.
- **Separate branch publish.** Keep a `hotseat-pages` branch that
  runs `build:hotseat` and publishes to a Pages preview URL. More
  ceremony, zero bundle-size impact, but feels like overkill for
  V1.

### Optional: runtime mode toggle (not recommended for V1)

The current `detectMode()` is build-time-only. A runtime toggle
would require:

- Building both transports into the bundle (cost: bundle size grows
  by ~10–20 KB gzipped for the SocketIO + bgio Local fragment).
- Adding a UI toggle on the lobby landing page.
- Persisting the choice in `localStorage` so a hot-seat user
  doesn't see the lobby on every refresh.

Cost-benefit is poor for V1. Defer until someone asks.

## Acceptance

- Push to `main` (or manual `workflow_dispatch`) →
  `deploy-pages.yml` runs `build:networked` with
  `VITE_SERVER_URL=<render-url>` baked in.
- Visiting the Pages URL shows `<LobbyShell>` (with `<AuthForms>`
  if not logged in), not the hot-seat board.
- The URL the lobby talks to (visible in DevTools → Network) is
  the Render hostname, not localhost.
- Auth + match-create + join + play round trip works against the
  Render server from the live Pages URL. (Plan 04 verifies.)
- If "drop hot-seat" is chosen: there is no hot-seat affordance on
  the live Pages site. If "hash route" is chosen: visiting
  `<pages>/#hotseat` mounts the hot-seat board.

## Risks / open questions

- **`VITE_SERVER_URL` is build-time-baked.** Changing the Render
  service URL later requires a re-deploy of Pages. Trivial; just
  flagging.
- **Render free tier sleeps after ~15 min idle.** First visitor
  after the wake window eats a ~30s cold start. The 10.6 reconnect
  spinner already covers this; no UI change needed.
- **Custom domain.** If we want a stable URL for the server,
  point a Render custom domain at the service and bake that into
  Pages instead. Out of scope here.
- **CORS coupling.** Plan 03 sets `ALLOWED_ORIGINS` on Render to
  include the GH Pages URL. If they're set to different values
  the lobby will silently fail with CORS errors on every fetch.
  Verify together as part of the smoke in plan 04.
- **Pages URL of record.** GitHub Project Pages publish to
  `https://<user>.github.io/<repo>`; User/Org Pages to
  `https://<user>.github.io`. We need the actual value to set
  both `VITE_SERVER_URL` (here, no — we set the *server* URL
  here) and `ALLOWED_ORIGINS` (in plan 03). Confirm before
  landing.

## Related

- 03 — `ALLOWED_ORIGINS` is the matching server-side setting and
  must land first or simultaneously.
- 04 — end-to-end smoke validates this plus the server.
