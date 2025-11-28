#!/bin/bash
set -e
mkdir -p /opt/ibiki-sms/tools
cat > /opt/ibiki-sms/tools/backup.sh <<"SH"
#!/bin/bash
set -e
TS=$(date +%Y%m%d-%H%M%S)
BKROOT=/opt/backups
BKDIR="$BKROOT/$TS"
mkdir -p "$BKDIR"
CODE_TAR="$BKDIR/code_$TS.tar.gz"
if tar --version >/dev/null 2>&1; then
  tar -czf "$CODE_TAR" --exclude='/opt/ibiki-sms/node_modules' --exclude='/opt/ibiki-sms/.git' -C /opt ibiki-sms
else
  echo 'TAR_NOT_FOUND'; exit 1
fi
DB_FILE="$BKDIR/db_$TS.sql"
if command -v pg_dump >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  pg_dump --dbname="$DATABASE_URL" --no-owner --format=plain -f "$DB_FILE" || echo 'PG_DUMP_FAILED' > "$BKDIR/db_backup_status.txt"
else
  echo 'PG_DUMP_NOT_AVAILABLE_OR_NO_DATABASE_URL' > "$BKDIR/db_backup_status.txt"
fi
ln -sfn "$BKDIR" "$BKROOT/latest"
echo BACKUP_DIR=$BKDIR
ls -lh "$BKDIR" | sed -n '1,40p'
SH

cat > /opt/ibiki-sms/tools/restore.sh <<"SH"
#!/bin/bash
set -e
TS=${1:-latest}
BKROOT=/opt/backups
if [ "$TS" = "latest" ]; then BKDIR=$(readlink -f "$BKROOT/latest"); else BKDIR="$BKROOT/$TS"; fi
if [ -z "$BKDIR" ] || [ ! -d "$BKDIR" ]; then echo "MISSING_BACKUP_DIR"; exit 1; fi
CODE_TAR=$(ls "$BKDIR"/code_*.tar.gz 2>/dev/null | head -n 1)
if [ -z "$CODE_TAR" ] || [ ! -f "$CODE_TAR" ]; then echo "MISSING_CODE_TAR"; exit 1; fi
pm2 stop ibiki-sms || true
TSNOW=$(date +%Y%m%d-%H%M%S)
mv /opt/ibiki-sms "/opt/ibiki-sms.prev.$TSNOW" || true
mkdir -p /opt/ibiki-sms
# Extract
tar -xzf "$CODE_TAR" -C /opt
DB_SQL=$(ls "$BKDIR"/db_*.sql 2>/dev/null | head -n 1)
if [ -n "$DB_SQL" ] && command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -f "$DB_SQL" || echo "PG_RESTORE_FAILED"
fi
cd /opt/ibiki-sms
npm ci --omit=dev || true
npm run build || true
pm2 start ibiki-sms --update-env
echo RESTORED_FROM=$BKDIR
SH

chmod +x /opt/ibiki-sms/tools/backup.sh /opt/ibiki-sms/tools/restore.sh
ls -l /opt/ibiki-sms/tools
