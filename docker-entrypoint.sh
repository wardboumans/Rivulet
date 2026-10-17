#!/bin/sh
# Starts as root only to make the database directory writable (bind mounts are often created
# root-owned), then drops to the unprivileged `node` user to run the app.
set -e

DATA_DIR="$(dirname "${DATABASE_PATH:-/data/reader.db}")"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
