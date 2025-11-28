#!/bin/bash
set -e
cd /opt/ibiki-sms
echo CHECK_PM2_ENV
pm2 env 0 | grep -E "DATABASE_URL|JWT|SESSION_SECRET|PORT|NODE_ENV" || true
if ! pm2 env 0 | grep -q "DATABASE_URL"; then
  echo DATABASE_URL_MISSING_TRY_ENV
  if [ -f .env ]; then
    set -a
    . ./.env
    set +a
    echo EXPORTED_DATABASE_URL=${DATABASE_URL:-missing}
    pm2 restart ibiki-sms --update-env || true
    sleep 2
  else
    echo NO_ENV_FILE
  fi
fi
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ibiki_dash@proton.me","password":"c0smic4382"}' | sed -n 's/.*"token":"\([^"\]*\)".*/\1/p')
echo TOKEN_LEN=${#TOKEN}
if [ ${#TOKEN} -eq 0 ]; then
  echo AUTH_FAILED
  pm2 restart ibiki-sms --update-env || true
  sleep 2
  pm2 logs ibiki-sms --lines 50 | sed -n '1,80p'
else
  echo AUTH_OK
  echo CLIENTS_HEAD:
  curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/clients | sed -n '1,12p'
  echo BALANCE_HEAD:
  curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/extremesms-balance | sed -n '1,12p'
fi
echo READY
