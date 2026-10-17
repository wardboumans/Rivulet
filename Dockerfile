# syntax=docker/dockerfile:1

# ---- deps: install node_modules. .npmrc sets ignore-scripts, so better-sqlite3 uses its bundled
# prebuilt binary instead of compiling (no C++ toolchain needed) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---- build: produce .next/standalone ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/ may be empty, and git doesn't track empty folders, so make sure it exists.
RUN mkdir -p public && npm run build

# ---- runtime: only the standalone server, static assets and public files ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/reader.db

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# The SQLite database (feeds, articles, settings and saved API keys) lives in /data: mount a volume.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

# The entrypoint fixes /data ownership (for bind mounts), then runs the app as `node`.
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 3000
CMD ["node", "server.js"]
