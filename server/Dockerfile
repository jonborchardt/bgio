# Placeholder Dockerfile for the bgio server.
#
# This is V1 — 13.2 owns the real deploy story (cloud target, env wiring,
# health checks, persistent storage). For now the goal is just: a multi-stage
# build that produces a small image running the server via `tsx`.
#
# We don't emit compiled JS in V1 (see server/tsconfig.json's note) — the
# shared `src/` tree imports `.ts` paths and JSON without import attributes,
# which is fine under Vite's bundler resolution but trips nodenext-strict
# emit. 13.2 will swap this for a bundler-emitted JS target.

# ---- builder ----------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (incl. dev) so we can run `tsc -p server` for typecheck.
COPY package.json package-lock.json ./
RUN npm ci

# Copy what the server build needs: server source, shared src, tsconfigs.
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY server ./server
COPY src ./src

# Typecheck only — emitting is handled at runtime by `tsx`.
RUN npm run server:build

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 8000

CMD ["npx", "tsx", "server/index.ts"]
