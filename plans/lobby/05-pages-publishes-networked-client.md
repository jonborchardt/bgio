# 05 — GitHub Pages publishes the networked client pointed at Cloud Run

**Severity**: high (without this, "users hit my client via GitHub" still
gets the hot-seat build with no server)
**Area**: client / build / CI
**Effort**: small
**Status**: not started
**Depends on**: plan 02 (we need the Cloud Run URL)

## Files
- [.github/workflows/deploy-pages.yml:34-39](../../.github/workflows/deploy-pages.yml) —
  flip `npm run build:hotseat` → `npm run build:networked` and pass
  `VITE_SERVER_URL`.
- [scripts/build-networked.mjs](../../scripts/build-networked.mjs) —
  already reads `process.env.VITE_SERVER_URL`. No change needed.
- [src/clientMode.ts:50-52](../../src/clientMode.ts) — already reads
  `VITE_SERVER_URL` (with localhost fallback). No change needed.
- [src/App.tsx](../../src/App.tsx) — already routes to `LobbyShell` in
  networked mode. No change needed.

## Problem
The Pages build today is the demo / fallback hot-seat single-tab
experience. The whole point of the user's question is that anyone
hitting the published Pages URL should land on the lobby, log in,
matchmake on the Cloud Run server, and play with other people. That
requires the Pages workflow to build in networked mode and bake the
Cloud Run URL into the bundle.

## Fix sketch

### Default approach: single networked Pages build

One build, points at Cloud Run, no runtime mode toggle.

1. Add a repo-level GitHub Actions secret or variable
   `VITE_SERVER_URL` = `https://settlement-server-<hash>-uc.a.run.app`
   (the Cloud Run service URL from plan 02).
2. Edit [.github/workflows/deploy-pages.yml](../../.github/workflows/deploy-pages.yml)
   build step:
   ```yaml
   - name: Build (networked, Cloud Run)
     env:
       VITE_SERVER_URL: ${{ vars.VITE_SERVER_URL }}
     run: npm run build:networked
   ```
   The script already exports `VITE_CLIENT_MODE=networked` and forwards
   `VITE_SERVER_URL`.
3. The `base: './'` Vite config keeps the build portable to whatever
   Pages URL hosts it.

### Hot-seat doesn't disappear

Two options:

- **Branch publish.** Keep a `hotseat-pages` branch (or use Pages
  preview environments) that runs `build:hotseat` for designers /
  bot fuzz. Easy to manage manually.
- **Hash route.** [App.tsx](../../src/App.tsx:234-256) already supports
  `#cards`, `#mats`, `#boards`, `#fuzz`. Add `#hotseat` that mounts
  `<HotSeatShell>` regardless of `detectMode()`. One networked build,
  but `https://<pages>/#hotseat` is a fallback.

Default: ship just the networked build. Hot-seat is a designer-only
need; we can address it if it actually comes up.

### Optional: runtime mode toggle (not recommended for V1)

The current `detectMode()` is build-time-only. A runtime toggle would
require:

- Building both transports into the bundle (cost: bundle size doubles
  for the SocketIO + bgio Local fragment — probably ~10–20 KB gzipped).
- Adding a UI toggle on the lobby landing page.
- Persisting the choice in `localStorage` so a hot-seat user doesn't
  see the lobby on every refresh.

The cost-benefit is poor for V1. Defer until someone asks.

## Acceptance

- Push to `main` → `deploy-pages.yml` runs `build:networked` with
  `VITE_SERVER_URL=<cloud-run-url>` baked in.
- Visiting the Pages URL shows `<LobbyShell>` (with `<AuthForms>` if
  not logged in), not the hot-seat board.
- Auth + match-create + join + play round trip works against the
  Cloud Run server from the live Pages URL.
- The URL the lobby talks to (visible in DevTools → Network) is the
  Cloud Run hostname, not localhost.

## Risks / open questions

- **`VITE_SERVER_URL` is build-time-baked.** Changing the Cloud Run URL
  later requires a re-deploy of Pages. Trivial; just flagging.
- **Custom domain.** If we want a stable URL for the server, point a
  Cloud Run custom domain (or a Cloud Load Balancer in front) at the
  service and bake that into Pages instead. Out of scope here.
- **CORS coupling.** Plan 06 sets `ALLOWED_ORIGINS` on Cloud Run to
  include the GH Pages URL. If they're set to different values the
  lobby will silently fail with CORS errors on every fetch. Verify
  together as part of 02 + 06 + 05 acceptance.

## Related

- 02 — Cloud Run URL is the input here.
- 06 — `ALLOWED_ORIGINS` is the matching server-side setting.
- 07 — end-to-end smoke validates this plus the server.
