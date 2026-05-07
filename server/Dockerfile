# Server image for Render.
#
# Multi-stage Node 20 image. The build stage runs `npm ci` and the typecheck
# (`server:build`); the runtime stage copies the dependency tree, server source,
# and shared `src/` tree, and starts the server through `vite-node`.
#
# Why `vite-node` at runtime instead of compiled JS or `tsx`:
# - Our shared `src/` tree imports `.ts` paths and JSON without import
#   attributes (matching Vite's bundler resolution). Switching to nodenext-
#   strict ESM emit would touch every JSON import in the codebase. A
#   Vite-flavored runner sidesteps that by running TypeScript directly.
# - `tsx` 4.x cannot resolve bgio's subpath imports
#   (`boardgame.io/server`, `boardgame.io/core`, …): bgio 0.50.x ships
#   per-subpath `package.json` files but no top-level `exports` field, and
#   tsx's resolver appends `.jsx` to the bare specifier instead of reading
#   the subpath's own `main`. vite-node uses the same resolver Vitest uses
#   for the server boot smoke test, so dev/test/prod stay aligned.
# - Render's free tier already pays a cold-start tax (15-min sleep wake-up);
#   a few extra ms of vite-node boot is rounding error.
#
# The native dep `better-sqlite3` compiles in `npm ci` on the builder
# stage and gets copied via `node_modules`. Render's build runs inside
# this container so the native binary matches the runtime libc.

# ---- builder ----------------------------------------------------------------
FROM node:20-alpine AS builder

# better-sqlite3 needs build tools for the native module.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install all deps (incl. dev) so we can run `tsc -p server` for typecheck and
# rebuild the better-sqlite3 native module against this image's libc.
COPY package.json package-lock.json ./
RUN npm ci

# Copy what the server build needs: server source, shared src, tsconfigs.
# card-decks/ ships the JSON content the data loaders glob over at
# module-eval time (and deck.config.json which deckSelection.ts imports
# directly) — without it, both the typecheck and the runtime fail to
# resolve the deck content.
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
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

# Render's persistent disk mounts at /data; the SQLite path defaults to
# /data/settlement.sqlite via render.yaml. Override locally with SQLITE_PATH.
ENV STORAGE_KIND=sqlite
ENV SQLITE_PATH=/data/settlement.sqlite

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
# Same content the builder stage copied: deck content + deck.config.json
# get globbed at module load by the data loaders, so they must exist on
# disk in the runtime container.
COPY --from=builder /app/card-decks ./card-decks
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# vite-node reads vite.config.ts to set up its resolver, so copy it too.
COPY --from=builder /app/vite.config.ts ./vite.config.ts

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
