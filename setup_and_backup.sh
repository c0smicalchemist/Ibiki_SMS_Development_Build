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
# Code backup
if tar --version >/dev/null 2>&1; then
  tar -czf "$CODE_TAR" --exclude='/opt/ibiki-sms/node_modules' --exclude='/opt/ibiki-sms/.git' -C /opt ibiki-sms
else
  echo 'TAR_NOT_FOUND'; exit 1
fi
# Database backup (Docker fallback)
DB_FILE="$BKDIR/db_$TS.sql"
DB_STATUS="$BKDIR/db_backup_status.txt"
if [ -n "$DATABASE_URL" ]; then
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --dbname="$DATABASE_URL" --no-owner --format=plain > "$DB_FILE" || echo 'PG_DUMP_FAILED' > "$DB_STATUS"
  elif command -v docker >/dev/null 2>&1; then
    python3 - <<'PY'
import os
from urllib.parse import urlparse
u=os.environ.get('DATABASE_URL','')
p=urlparse(u)
print(f"export PGHOST='{p.hostname or ''}'")
print(f"export PGPORT='{p.port or 5432}'")
print(f"export PGUSER='{p.username or ''}'")
print(f"export PGPASSWORD='{p.password or ''}'")
print(f"export PGDB='{(p.path or '/').lstrip('/')}'")
PY
    . /dev/stdin
    docker run --rm -e PGPASSWORD="$PGPASSWORD" postgres:16 pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDB" -p "$PGPORT" --no-owner --format=plain > "$DB_FILE" || echo 'DOCKER_PG_DUMP_FAILED' > "$DB_STATUS"
  else
    echo 'PG_TOOLS_NOT_AVAILABLE' > "$DB_STATUS"
  fi
else
  echo 'NO_DATABASE_URL' > "$DB_STATUS"
fi
ln -sfn "$BKDIR" "$BKROOT/latest"
echo BACKUP_DIR=$BKDIR
ls -lh "$BKDIR" | sed -n '1,20p'
SH
chmod +x /opt/ibiki-sms/tools/backup.sh
/opt/ibiki-sms/tools/backup.sh
