#!/bin/bash
# Starts a local Postgres for the database tests (tests/db.test.js), once: PGDATA under /var/tmp, port 5499.
# Needs the Postgres server installed (here 16); runs it as the postgres user.
set -e
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
DATA=${RANKPG_DATA:-/var/tmp/rankpg/data}; PORT=${RANKPG_PORT:-5499}
if ! su postgres -c "$BIN/pg_ctl -D $DATA status" >/dev/null 2>&1; then
  if [ ! -f "$DATA/PG_VERSION" ]; then mkdir -p "$DATA"; chown -R postgres:postgres "$(dirname "$DATA")"; su postgres -c "$BIN/initdb -D $DATA -A trust -U postgres" >/dev/null; fi
  su postgres -c "$BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $(dirname "$DATA")/log -w start" >/dev/null
fi
echo "postgres on port $PORT"
