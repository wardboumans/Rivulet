# syntax=docker/dockerfile:1

# ---- deps: install node_modules (better-sqlite3 ships a prebuilt binary for linux x64;
# the build tools are only a fallback for platforms without one) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: produce .next/standalone ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

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
