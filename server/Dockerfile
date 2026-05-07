# Server image for Render.
#
# Multi-stage Node 20 image. The builder stage runs `npm ci` (which also
# compiles the `better-sqlite3` native module against this image's libc)
# and `tsc -p server` as a typecheck gate. The runtime stage copies the
# built `node_modules` from the builder and the source directly from the
# build context, then starts the server through `vite-node`.
#
# Why `vite-node` at runtime instead of compiled JS or `tsx`:
# - Our shared `src/` tree imports `.ts` paths and JSON without import
#   attributes (matching Vite's bundler resolution). Switching to
#   nodenext-strict ESM emit would touch every JSON import in the
#   codebase. A Vite-flavored runner sidesteps that.
# - `tsx` 4.x cannot resolve bgio's subpath imports
#   (`boardgame.io/server`, `boardgame.io/core`, …): bgio 0.50.x ships
#   per-subpath `package.json` files but no top-level `exports` field,
#   and tsx's resolver appends `.jsx` to the bare specifier instead of
#   reading the subpath's own `main`. vite-node uses the same resolver
#   Vitest uses for the server boot smoke test, so dev/test/prod stay
#   aligned.
# - Render's free tier already pays a cold-start tax (15-min sleep
#   wake-up); a few extra ms of vite-node boot is rounding error.
#
# COPY discipline (read this before adding/removing a COPY line):
#   The runtime stage must contain every file the server imports
#   (transitively from `server/start.ts`). The list is:
#     server/                — server entry + factory + storage / auth /
#                              bots / idle / runs modules
#     src/                   — shared game (`src/game/`), data loaders
#                              (`src/data/`), card registry (`src/cards/`)
#     card-decks/            — deck JSON content + deck.config.json
#                              (data loaders glob + deckSelection.ts
#                              imports directly)
#     package.json /         — vite-node reads package.json as the
#       package-lock.json      project-root marker; the lockfile keeps
#                              `npm ci`-equivalent state on the runtime
#                              for any dynamic dep resolution
#     tsconfig.json /        — vite-node honours compilerOptions / paths
#       tsconfig.app.json /    from the TS config tree (the root file
#       tsconfig.node.json     references the others)
#     vite.config.ts         — vite-node reads it for resolve.alias and
#                              project root
#   The builder stage mirrors the SAME source list (so the typecheck
#   exercises the same files), plus build-time tools.
#
#   When a new directory at the repo root becomes a runtime import
#   target, add it BOTH here and in `server/tsconfig.json`'s `include`.

# ---- builder ----------------------------------------------------------------
FROM node:20-alpine AS builder

# better-sqlite3 needs build tools for the native module.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install all deps (incl. dev) so we can run `tsc -p server` for the
# typecheck and rebuild the better-sqlite3 native module against this
# image's libc.
COPY package.json package-lock.json ./
RUN npm ci

# Source needed for the typecheck — keep this list in sync with the
# runtime stage below and with `server/tsconfig.json`'s `include`.
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY server ./server
COPY src ./src
COPY card-decks ./card-decks

# Typecheck only — emitting is handled at runtime by `vite-node`.
RUN npm run server:build

# ---- runtime ----------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Defaults for ad-hoc `docker run` invocations. Render injects its own
# values per `render.yaml` (currently `STORAGE_KIND=memory` on free tier;
# the SQLite-backed values become correct once the service upgrades to
# Starter + persistent disk per the upgrade path in `render.yaml`'s
# header).
ENV STORAGE_KIND=sqlite
ENV SQLITE_PATH=/data/settlement.sqlite

# node_modules from the builder carries the alpine-built native binary
# of better-sqlite3 — don't reinstall in this stage or the binary
# rebuilds against the runtime image's toolchain (which lacks the build
# tools we apt-installed in the builder).
COPY --from=builder /app/node_modules ./node_modules

# Source comes from the build context, not the builder. The builder
# isn't transforming any of these files, so chaining through it would
# just be a wasted pass-through. Mirrors the COPY discipline list at
# the top of this Dockerfile.
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./
COPY server ./server
COPY src ./src
COPY card-decks ./card-decks

# Issue 045 — drop privileges. The `node` user ships in the official
# Node image; chown the app tree + the persistent data mount so
# vite-node + better-sqlite3 can read/write under it.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 8000

# Issue 045 — Render's free tier auto-restarts on hard failure, but a
# liveness check here lets local docker / non-Render runs surface a
# wedged process. `wget` ships in the alpine base. The `/games`
# endpoint is bgio's lobby root — a 200 means the Koa app is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/games || exit 1

# Call vite-node directly (resolved at build time so every restart skips
# npx's per-invocation lookup tax).
CMD ["node", "/app/node_modules/vite-node/dist/cli.js", "server/start.ts"]
