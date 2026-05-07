# 03 — Storage on Cloud Run: SQLite-on-volume vs Cloud SQL

**Severity**: critical (load-bearing decision)
**Area**: server / storage
**Effort**: small (option A) → medium (option B) → large (option C)
**Status**: not started — decision required before plans 02 and 04
land

## The decision

Cloud Run instances are ephemeral. The current SQLite file
(`/data/settlement.sqlite`) needs to live somewhere durable. Three options;
this plan recommends **A** for V1 and frames B as the upgrade path.

| | A. SQLite + GCS-FUSE volume | B. Cloud SQL Postgres | C. Firestore |
|---|---|---|---|
| Code change in `server/` | none | replace SQLite adapter with a Postgres `Async` adapter (or use [`bgio-postgres`](https://www.npmjs.com/package/bgio-postgres)) | write new `Async` adapter; no community fork |
| Multi-instance safe | **no** (must `maxScale=1`) | yes | yes |
| Persistence | yes (GCS) | yes (Cloud SQL) | yes |
| Ops complexity | low (one bucket) | medium (Cloud SQL instance, IAM) | low (managed, auto-scale) |
| Latency overhead | GCS-FUSE adds ~10–50ms per disk op vs local | ~1–5ms in-region | ~5–30ms |
| Cost | bucket storage only (~$0/month at our size) | always-on instance ($7+/mo for db-f1-micro on free tier expired, more on db-g1-small) | pay-per-op |
| `bgio-postgres` published | n/a | yes (community pkg) | n/a |

**Recommendation: A.** SQLite + GCS volume + `maxScale=1`. This is the
smallest possible delta from the existing code, defers the
multi-instance work, and matches the project's V1 stance ("networked
playtest is unverified end-to-end" per CLAUDE.md). Switch to B when
real concurrent load shows up; the seam is a single-line `db:` in
[server/index.ts](../../server/index.ts:114).

## Files (option A)

- (no edits to source) — the existing SQLite adapter at
  [server/storage/sqlite.ts](../../server/storage/sqlite.ts) and the
  storage factory at [server/storage/index.ts](../../server/storage/index.ts)
  Just Work against a mounted-file path.
- [cloudrun/service.yaml](02-cloud-run-deploy.md) — adds the
  `gcsfuse.run.googleapis.com` volume mount (sketch in plan 02).
- (one-time) provision a GCS bucket: `gsutil mb -l us-central1
  gs://settlement-server-data` and grant the deploy service account
  `roles/storage.objectAdmin` on it.

## Problem (in detail)

`better-sqlite3` opens its DB file with `O_RDWR | O_CREAT` and uses
WAL mode. Both work over GCS-FUSE:

- File creation: GCS-FUSE creates a single object per file in the bucket.
- WAL mode: the WAL + `-shm` companion files are also objects. They
  do mean every transaction is multiple GCS PUTs. Latency is the trade.

Two real concerns:

1. **Concurrent writers.** `maxScale=1` already forbids that. SQLite
   has its own file lock, and GCS-FUSE forwards POSIX locks per its
   documentation, but two writers across instances is a known foot
   gun. Pinning to one instance side-steps the question entirely.
2. **`fsync` semantics.** GCS-FUSE batches writes; an `fsync` after a
   bgio `setState` returns before the write is durable in GCS by
   default. This is acceptable for V1 (worst case: a single match's
   most-recent move is lost on container kill) but worth measuring.
   The `--implicit-dirs` and `--file-mode 0644` defaults in
   `gcsfuse.run.googleapis.com` are fine.

## Fix sketch — option A (recommended)

1. Provision the bucket out-of-band:
   ```
   gsutil mb -l us-central1 gs://settlement-server-data
   gsutil iam ch serviceAccount:settlement-server@PROJECT.iam.gserviceaccount.com:objectAdmin \
     gs://settlement-server-data
   ```
2. The Cloud Run service spec from plan 02 already mounts this bucket
   at `/data`. Set `SQLITE_PATH=/data/settlement.sqlite` (already the
   default in `.env.example`).
3. First request after deploy creates the file inside the bucket.
   Subsequent deploys / instance recycles re-attach the same bucket
   and the file persists.
4. Verify: register an account, force a revision rollover
   (`gcloud run deploy ... --image $LATEST`), log in again — same
   account.
5. Issue 007 (runs persistence) collapses into this — the SQLite runs
   store at [server/runs/sqliteRunsStore.ts](../../server/runs/sqliteRunsStore.ts)
   uses the same DB file. No code change.

## Fix sketch — option B (Cloud SQL Postgres, when V1 proves networked)

1. Add `bgio-postgres` (or write `server/storage/postgres.ts`
   matching the bgio `Async` shape — about 100 lines, the same shape
   as `sqlite.ts`).
2. Extend `StorageKind` in
   [server/storage/index.ts](../../server/storage/index.ts) with
   `'postgres'`; route through to the new adapter when env says so.
3. Provision a Cloud SQL instance + DB; create a service account with
   `cloudsql.client`; mount the Cloud SQL Auth Proxy as a sidecar (or
   use Cloud Run's built-in Cloud SQL connector). Connection string
   via `DATABASE_URL` env.
4. Mirror the accounts and runs stores onto Postgres
   ([server/auth/sqliteAccountsStore.ts](../../server/auth/sqliteAccountsStore.ts)
   and [server/runs/sqliteRunsStore.ts](../../server/runs/sqliteRunsStore.ts)
   each get a sibling Postgres adapter; the abstract `accountsStore`
   / `runsStore` seams already exist).
5. Migrations: bgio's adapter creates its own table; ours need a real
   migration runner — issue 022 (no migration version table) becomes
   real here. `node-pg-migrate` is the cheapest fit.
6. Drop `maxScale=1` from the service spec; plan 04's Redis adapter
   becomes the next blocker.

## Fix sketch — option C (Firestore, not recommended for V1)

Skipped. We'd be writing a brand-new `Async` adapter and validating it
ourselves. No upside over A for single-instance V1; B is the right
choice when we outgrow A.

## Acceptance (option A)

- After `cloudrun/service.yaml` deploys, `gcsfuse.run.googleapis.com`
  shows the bucket mounted at `/data` in the revision logs.
- `STORAGE_KIND=sqlite SQLITE_PATH=/data/settlement.sqlite` is set on
  the running revision (`gcloud run services describe`).
- Register a user → restart the revision (deploy a no-op image push) →
  the user can log in again.
- Create a match in tab A → restart → tab A's persisted creds resume
  the match.
- 30-min idle → Cloud Run scales-to-zero or the instance recycles →
  the next request mounts the same bucket, accounts and matches are
  intact.

## Risks / open questions

- **Latency.** GCS-FUSE first-write of a new object is ~50–200ms.
  That's amortised across every move under load — measurable but not
  a problem at V1 scale (handful of concurrent matches). If it shows
  up in the e2e smoke timing budgets, plan B is the answer.
- **`maxScale=1` ceiling.** A single Cloud Run instance with
  `concurrency=250` can absorb dozens of simultaneous matches. If we
  ever pass that, we *must* migrate to plan B (and plan 04 Redis) —
  there's no horizontal headroom on plan A.
- **Backups.** GCS objects are durable but the SQLite file is one
  object. A nightly `gsutil cp gs://settlement-server-data/settlement.sqlite
  gs://settlement-backups/$(date)/...` cron is sufficient for V1; out
  of scope for this plan.

## Related

- 04 (multi-instance) — option A pins this off; option B requires it.
- 02 (deploy) — service spec wires the volume.
- 022 (migration version table) — only relevant for option B.
- 007 (runs persistence) — closes naturally under option A; under B
  it's part of the rewrite.
