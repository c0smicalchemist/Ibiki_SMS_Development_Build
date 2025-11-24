#!/bin/bash
set -e
DIR="/var/backups/ibiki-sms"
mkdir -p "$DIR"
ENV_FILE=".env.production"
if [ -z "$DATABASE_URL" ]; then
  if [ -f "$ENV_FILE" ]; then
    export DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2-)
  fi
fi
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL missing" >&2
  exit 1
fi
TS=$(date +%Y%m%d-%H%M%S)
FILE="$DIR/ibiki-sms-$TS.dump"
pg_dump "$DATABASE_URL" -Fc -f "$FILE"
ls -lh "$FILE"
find "$DIR" -type f -name "ibiki-sms-*.dump" -mtime +30 -delete || true
echo "Backup complete: $FILE"

