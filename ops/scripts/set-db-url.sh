#!/usr/bin/env bash
set -e
DB_URL="postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki"
APP_DIR="/opt/ibiki-sms"

printf "DATABASE_URL=%s\nRUN_DB_MIGRATIONS=true\nRUN_DB_BOOTSTRAP=true\nPOSTGRES_SSL=false\nLOG_LEVEL=debug\n" "$DB_URL" > "$APP_DIR/.env.production"
cp "$APP_DIR/.env.production" "$APP_DIR/.env"

if command -v psql >/dev/null 2>&1; then
  psql "$DB_URL" -c "SELECT 1;" || true
fi

pm2 restart ibiki-sms --update-env || true
echo DB_URL_APPLIED
