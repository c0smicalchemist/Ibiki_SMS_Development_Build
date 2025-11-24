#!/usr/bin/env bash
set -e

PACKAGE_PATH="$1"         # e.g. /root/ibiki-sms-YYYYMMDDHHMMSS.tar.gz
ENV_SOURCE="$2"           # local env file uploaded to server, e.g. /root/.env.production
APP_DIR="/opt/ibiki-sms"  # app root on server

echo "[deploy] Installing prerequisites (Node 20, PM2)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2 >/dev/null 2>&1 || true

echo "[deploy] Preparing app directory: $APP_DIR"
mkdir -p "$APP_DIR"
tar -xzf "$PACKAGE_PATH" -C "$APP_DIR"
cd "$APP_DIR"

if [ -f "$ENV_SOURCE" ]; then
  cp "$ENV_SOURCE" .env
fi

echo "[deploy] Installing production dependencies"
npm ci --omit=dev

echo "[deploy] Starting app with PM2 (auto-migrations enabled)"
pm2 delete ibiki-sms || true
PM2_ENV="RUN_DB_MIGRATIONS=true NODE_ENV=production"
pm2 start dist/index.js --name ibiki-sms --env "$PM2_ENV"
pm2 save
echo "[deploy] Done"
