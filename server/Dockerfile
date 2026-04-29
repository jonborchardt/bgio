# 13.2 — Server image for Render.
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
# - 14.14 swapped `tsx` for `vite-node` because tsx 4.x mis-resolves bgio's
#   subpath imports (`boardgame.io/server`, `boardgame.io/core`, …) — see
#   plans/14.11-networked-playtest-findings.md F1. vite-node uses the same
#   resolver Vitest uses for the boot smoke test, so dev/test/prod stay
#   aligned.
# - Render's free tier already pays a cold-start tax (15-min sleep wake-up);
#   a few extra ms of vite-node boot is rounding error.
#
# The native dep `better-sqlite3` (added in 13.3) compiles in `npm ci` on
# the builder stage and gets copied via `node_modules`. Render's build runs
# inside this container so the native binary matches the runtime libc.

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
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY server ./server
COPY src ./src

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
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# vite-node reads vite.config.ts to set up its resolver, so copy it too.
COPY --from=builder /app/vite.config.ts ./vite.config.ts

EXPOSE 8000

# `npm run server:start` shells out to `vite-node server/start.ts`; we
# call the script directly to keep the entrypoint visible in process
# listings.
CMD ["npx", "vite-node", "server/start.ts"]
