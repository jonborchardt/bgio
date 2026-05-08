# 03 — Persistence: Starter tier + SQLite, or document the wipe

**Severity**: high (state is gone every cold start; users notice
within 15 minutes)
**Area**: server / config (no code change required)
**Effort**: tiny — four lines of `render.yaml` + $7/month
**Status**: not started — decision required

## The decision

Render's free tier has no persistent disk. Today `render.yaml` sets
`STORAGE_KIND=memory`, so every cold start (deploy / 15-min idle
recycle / manual restart) wipes:
- All registered accounts.
- All matches and their state.
- The runs history.

For a real playtest this is unworkable. Two options:

| | A. Stay on free tier | B. Upgrade to Starter |
|---|---|---|
| Cost | $0 | $7 / month |
| Persistence | None — wipes on every cold start | SQLite on a 1 GB persistent disk; survives restarts |
| Cold-start frequency | Every ~15 min idle | Every ~15 min idle (still — that's a Render free-tier thing the disk doesn't fix... wait, Starter doesn't sleep) |
| Cold-start data loss | Total | None |
| Code change | None | None — `render.yaml` only |
| Testing realism | Low — can't ask a friend to register and come back tomorrow | Real |

**Note on cold starts**: Render's free tier sleeps after ~15 min idle
AND wipes ephemeral storage. Starter doesn't sleep at all (so no cold
start) AND has the persistent disk. So upgrading to Starter solves
*both* problems, not just persistence.

**Recommendation: B (Starter).** $7/month is well below the threshold
of "what's my time worth", and the playtest experience changes
qualitatively from "demo only" to "actually useful". If the user is
philosophically opposed, A is documented loudly.

## Files

- [render.yaml](../../render.yaml) — the file's header already
  documents the four-line upgrade path. This plan is "execute that
  upgrade".
- [CLAUDE.md](../../CLAUDE.md) — currently has a "Free-tier in-memory
  storage in production" caveat under "Known V1 caveats". Once the
  upgrade lands, that bullet comes down (and the "Storage state,
  current reality" paragraph in the Deployment section reverts to
  the SQLite description).

## Fix sketch — option B (recommended)

Edit [render.yaml](../../render.yaml):

```diff
 services:
   - type: web
     name: settlement-server
     runtime: docker
-    plan: free
+    plan: starter
     region: oregon
     branch: main
     dockerfilePath: ./server/Dockerfile
     dockerContext: .
     healthCheckPath: /games
     autoDeploy: true
     envVars:
       - key: NODE_ENV
         value: production
       - key: PORT
         value: "8000"
-      - key: STORAGE_KIND
-        value: memory
+      - key: STORAGE_KIND
+        value: sqlite
+      - key: SQLITE_PATH
+        value: /data/settlement.sqlite
       - key: TRUST_PROXY
         value: "true"
       - key: ALLOWED_ORIGINS
         value: https://jonborchardt.github.io
+    disk:
+      name: data
+      mountPath: /data
+      sizeGB: 1
```

Push to main → Render's blueprint sync provisions the disk on the
next deploy → SQLite path is now durable.

After verification, edit `render.yaml`'s file header to drop the
"free-tier caveat" preamble, and edit CLAUDE.md (Deployment section
+ Known V1 caveats list) to reflect the new state.

## Fix sketch — option A (stay free)

No file edit. Just acknowledge the wipe behavior loudly:

- Update `LobbyShell` to show a small banner: "Heads up: this is a
  free-tier playtest. Accounts and matches reset every ~15 min of
  inactivity."
- Update `<AuthForms>` register flow with a similar warning.

This is honest but limits real testing. Recommend only if cost is
the primary blocker.

## Acceptance (option B)

- `render.yaml` shows `plan: starter`, `STORAGE_KIND=sqlite`,
  `SQLITE_PATH=/data/settlement.sqlite`, and a `disk:` block.
- After deploy:
  - Render dashboard shows the service running on Starter, with the
    persistent disk mounted at `/data`.
  - `gcloud equivalent`: there isn't one, but `df -h /data` via the
    Render shell (if you enable it) confirms the mount.
- Smoke test: register a user → push a no-op deploy → log in again →
  same account.
- Smoke test: create a match → wait 30+ minutes → revisit → match
  is still listed in `/games/settlement` (storage survived idle).

## Acceptance (option A)

- A "free-tier wipe" banner is visible in the lobby.
- The user-facing message in `<AuthForms>` mentions ephemeral
  accounts.
- CLAUDE.md and `render.yaml` continue to call out the limitation
  prominently.

## Risks / open questions

- **`better-sqlite3` native build on Starter.** The Dockerfile already
  builds it in the alpine builder stage — same image layer, just
  needs the `/data` mount to write to. No code change.
- **First-time SQLite migrations.** The accounts and runs tables
  auto-create via `runMigrations()` on first DB open. Issue 022
  (no migration version table) becomes more relevant once we have
  durable state — adding a column later means a real migration. Out
  of scope here.
- **Dockerfile defaults.** [server/Dockerfile](../../server/Dockerfile)
  hardcodes `ENV STORAGE_KIND=sqlite` and `ENV SQLITE_PATH=/data/...`
  for ad-hoc `docker run`. Render's blueprint env vars override
  these. With option B these defaults are correct again. With option
  A they were misleading (correct once you upgrade); leave as-is.
- **Render Starter SLA.** Starter is a paid tier with no free hours;
  the service runs 24/7. Cancel via dashboard if you ever stop
  needing it.

## Related

- 01 (stale-creds) — option A makes wipes frequent → 01 becomes
  load-bearing. Option B makes wipes rare → 01 is still nice to
  have for the "match was deleted" / "creds invalidated" cases but
  far less critical.
- CLAUDE.md "Known V1 caveats" — update once option B is live.
- issue 022 — migration version table; relevant after option B
  lands and we want to ship a schema change.
