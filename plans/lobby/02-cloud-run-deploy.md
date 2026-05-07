# 02 — Cloud Run deploy: service config + CI

**Severity**: high (blocks the host swap)
**Area**: infra / deploy
**Effort**: medium
**Status**: not started
**Depends on**: [03 storage decision](03-storage-on-cloud-run.md),
[04 multi-instance readiness](04-multi-instance-readiness.md). Pick those
defaults first; this plan defaults to "single instance + SQLite on
GCS volume" and notes where Postgres / multi-instance changes the
service.

## Files
- (new) `cloudrun/service.yaml` — Knative-style service spec, source of
  truth for the deploy.
- (new) `.github/workflows/deploy-cloudrun.yml` — push-on-main workflow
  that builds + pushes the image to Artifact Registry and updates the
  service.
- (no edits) [server/Dockerfile](../../server/Dockerfile) — already
  Cloud-Run-compatible (Node 20 alpine, listens on `$PORT`, runs as
  non-root `node`). The `HEALTHCHECK` line is local-docker only; Cloud
  Run ignores it and uses the probes defined on the service.
- [server/index.ts](../../server/index.ts:121-129) — already honours
  `TRUST_PROXY`. Cloud Run terminates TLS at its edge; flip this on.
- [server/index.ts](../../server/index.ts:89-99) — already honours
  `ALLOWED_ORIGINS`. Plan 06 sets the value.

## Problem
The server is built and dockerised but only Render knows how to deploy
it. Cloud Run needs:

- A container image in Artifact Registry (or GCR) that Cloud Run can
  pull at deploy.
- A service definition with the right port, env vars, scale bounds,
  startup / liveness probes, request timeout (websockets!), session
  affinity, CPU allocation, and the optional GCS volume mount from
  plan 03.
- A CI path that builds the image, pushes it, and rolls the service —
  the way `deploy-server.yml` does today for Render's auto-deploy.

## Fix sketch

### 1. Artifact Registry repo (one-time, manual)

```
gcloud artifacts repositories create settlement \
  --repository-format=docker \
  --location=us-central1 \
  --description="Settlement bgio server images"
```

### 2. `cloudrun/service.yaml`

A Knative `Service` that pins the load-bearing settings. Sketch:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: settlement-server
  annotations:
    run.googleapis.com/launch-stage: GA
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2   # gen2 for volume mounts + websockets
        run.googleapis.com/cpu-throttling: "false"        # always-allocated; idleWatcher + botDriver need to keep ticking
        run.googleapis.com/sessionAffinity: "true"        # required for SocketIO long-poll fallback
        autoscaling.knative.dev/minScale: "1"             # avoid cold starts hitting matchmaking
        autoscaling.knative.dev/maxScale: "1"             # plan-03 default; bump only after plan-04 redis adapter
    spec:
      timeoutSeconds: 3600                                # max websocket connect duration
      containerConcurrency: 250                           # generous; per-instance
      serviceAccountName: settlement-server@PROJECT.iam.gserviceaccount.com
      containers:
        - image: us-central1-docker.pkg.dev/PROJECT/settlement/server:latest
          ports:
            - name: http1
              containerPort: 8000
          env:
            - name: NODE_ENV
              value: production
            - name: STORAGE_KIND
              value: sqlite
            - name: SQLITE_PATH
              value: /data/settlement.sqlite
            - name: TRUST_PROXY
              value: "true"
            - name: ALLOWED_ORIGINS
              value: https://YOUR-ORG.github.io                # set by plan 06
          resources:
            limits:
              cpu: "1"
              memory: 512Mi
          startupProbe:
            httpGet:
              path: /games
              port: 8000
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /games
              port: 8000
            periodSeconds: 30
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          csi:
            driver: gcsfuse.run.googleapis.com
            volumeAttributes:
              bucketName: settlement-server-data            # provisioned out-of-band
```

Notes per setting (load-bearing):

- **gen2 execution environment** is required for both volume mounts and
  full websocket support without surprising connection drops.
- **`cpu-throttling: false`** keeps the container's `setInterval`s alive
  (idle watcher, bot driver, log compaction). Without this, a quiet
  match goes silent because the timers stop firing between requests.
- **`minScale: 1`** is opinionated — it costs a always-on instance, but
  matches the project's Render flow ("first visitor of the day eats
  cold start" stops being a thing). Set to 0 for cost-minimised
  preview environments.
- **`maxScale: 1`** is the plan-03 default. Multi-instance requires the
  Redis adapter from plan 04; until that lands this **must stay at 1**
  or matches will lose moves silently.
- **`sessionAffinity: true`** is necessary for SocketIO's long-poll
  fallback. With WebSocket-only it's belt-and-suspenders.
- **`timeoutSeconds: 3600`** is the request-duration cap; Cloud Run
  closes WebSockets when the underlying request hits this. One hour
  beats the Render default (5min) — the client side already reconnects
  via SocketIO, but minimising disconnects keeps reconnects fewer.
- **Volume mount on `/data`** matches the existing `SQLITE_PATH=/data/...`
  contract verbatim. Plan 03 covers the bucket / lifecycle.

### 3. CI workflow `.github/workflows/deploy-cloudrun.yml`

Replace or sit alongside `deploy-server.yml`. Authenticate via Workload
Identity Federation (no long-lived service account JSON in repo
secrets):

```yaml
name: deploy-cloudrun
on:
  workflow_dispatch: {}
  push:
    branches: [main]
    paths:
      - "server/**"
      - "src/game/**"
      - "package.json"
      - "package-lock.json"
      - "tsconfig*.json"
      - "cloudrun/**"
      - ".github/workflows/deploy-cloudrun.yml"

permissions:
  contents: read
  id-token: write          # WIF auth

concurrency:
  group: deploy-cloudrun-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    # same body as deploy-server.yml — server typecheck + tests + lint.
    # Keep this gate so a broken server can't deploy.

  build-deploy:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_DEPLOY_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build + push image
        run: |
          gcloud auth configure-docker us-central1-docker.pkg.dev
          IMAGE=us-central1-docker.pkg.dev/$PROJECT/settlement/server:${{ github.sha }}
          docker build -f server/Dockerfile -t "$IMAGE" .
          docker push "$IMAGE"
          echo "IMAGE=$IMAGE" >> "$GITHUB_ENV"
      - name: Render service.yaml + deploy
        run: |
          sed -i "s|image: .*|image: $IMAGE|" cloudrun/service.yaml
          gcloud run services replace cloudrun/service.yaml --region us-central1
```

The `validate` job is verbatim from `deploy-server.yml` — re-use it
rather than duplicate. (One option: have `deploy-cloudrun.yml`
`needs: validate` from a shared reusable workflow.)

### 4. Decommission Render or run in parallel

Plan 07 covers the cutover. Until that decision lands, leave
`render.yaml` and `deploy-server.yml` in place.

## Acceptance

- A push to `main` that touches `server/**` results in a new image
  in Artifact Registry and a Cloud Run revision rolling forward.
- `gcloud run services describe settlement-server --region=us-central1`
  shows the revision serving traffic with the env vars from the spec.
- `curl https://settlement-server-<hash>-uc.a.run.app/games` returns
  the bgio lobby root JSON `{ "games": [{ "name": "settlement" }] }`.
- A SocketIO connection from a local `wscat` (or the Pages build per
  plan 05) stays open past 60s without server-side disconnects.
- `gcloud run services describe ...` shows
  `cpu-throttling: false`, `sessionAffinity: true`, `minScale=1`,
  `maxScale=1`.
- Plan 03's chosen storage path is reachable from the running
  container (verified by registering an account, restarting the
  service, logging in again successfully).

## Risks / open questions

- **Cost.** `minScale=1` + always-allocated CPU + a tiny GCS volume is
  a few USD/month. Acceptable for a real game; revisit if it's not.
- **Region pinning.** `us-central1` is a default; the user might want
  one closer to expected playtest geography. Trivial to change but
  requires re-creating the bucket in the same region.
- **The image name in `service.yaml` drifts** unless we always rewrite
  it from CI (sketch above does). An alternative is to use
  `gcloud run deploy` with `--image` instead of `replace`, which
  doesn't require checked-in YAML — at the cost of losing the YAML as
  source-of-truth. Default: keep YAML, rewrite image in CI.

## Related

- 03 (storage decision — drives the volume mount + env)
- 04 (multi-instance — would change `maxScale` and require Redis adapter)
- 06 (CORS / secrets — the env values plug into this YAML)
- 07 (acceptance + Render decommission)
