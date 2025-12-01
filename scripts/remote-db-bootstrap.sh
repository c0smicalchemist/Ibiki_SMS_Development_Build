#!/usr/bin/env bash
set -e

ENV_FILE="/root/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "[env] $ENV_FILE not found; aborting DB bootstrap" >&2
  exit 1
fi

URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/^DATABASE_URL=//')
if [ -z "$URL" ]; then
  echo "[env] DATABASE_URL missing in $ENV_FILE" >&2
  exit 1
fi

# Parse DATABASE_URL (postgresql://user:pass@host:port/dbname)
DB_USER=$(echo "$URL" | sed -E 's#^[^:]+://([^:]+):[^@]+@.*#\1#')
DB_PASS=$(echo "$URL" | sed -E 's#^[^:]+://[^:]+:([^@]+)@.*#\1#')
DB_HOST=$(echo "$URL" | sed -E 's#^[^@]+@([^:/?]+).*#\1#')
DB_PORT=$(echo "$URL" | sed -E 's#^[^@]+@[^:]+:([0-9]+).*#\1#')
DB_NAME=$(echo "$URL" | sed -E 's#.*/([^/?]+).*#\1#')

DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}

echo "[db] ensure role+db ($DB_USER@$DB_HOST:$DB_PORT/$DB_NAME)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo "[db] test connect"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" || true

echo "[app] restart"
pm2 restart ibiki-sms --update-env || true
sleep 2
echo "[health] local"
curl -sS -m 6 http://127.0.0.1:5000/api/health || true
echo "[health] public"
curl -sS -m 8 https://ibiki.run.place/api/health || true
