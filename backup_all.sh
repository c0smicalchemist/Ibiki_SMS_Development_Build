#!/bin/bash
set -e
TS=$(date +%Y%m%d-%H%M%S)
BKROOT=/opt/backups
BKDIR=$BKROOT/$TS
mkdir -p "$BKDIR"
CODE_TAR=$BKDIR/ibiki_sms_code_$TS.tar.gz
# Create code backup (excluding heavy dev folders)
if tar --version >/dev/null 2>&1; then
  tar -czf "$CODE_TAR" \
    --exclude='/opt/ibiki-sms/node_modules' \
    --exclude='/opt/ibiki-sms/.git' \
    -C /opt ibiki-sms
else
  echo 'TAR_NOT_FOUND'
fi
# Database backup if tools available
DB_FILE=$BKDIR/ibiki_sms_db_$TS.sql
if command -v pg_dump >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  pg_dump --dbname="$DATABASE_URL" --no-owner --format=plain -f "$DB_FILE" || echo 'PG_DUMP_FAILED'
else
  echo 'PG_DUMP_NOT_AVAILABLE_OR_NO_DATABASE_URL' > "$BKDIR/db_backup_status.txt"
fi
# Point latest symlink
ln -sfn "$BKDIR" "$BKROOT/latest"
# Output summary only
echo BACKUP_DIR=$BKDIR
ls -lh "$BKDIR" | sed -n '1,50p'
