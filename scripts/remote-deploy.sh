#!/usr/bin/env bash
set -e
APP_DIR="/opt/ibiki-sms"
PKG="/root/ibiki-sms.tar.gz"
ENV="/root/.env.production"

echo "[deploy] Installing prerequisites (Node 20, PM2)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2 >/dev/null 2>&1 || true

echo "[deploy] Preparing app directory: $APP_DIR"
mkdir -p "$APP_DIR"
tar -xzf "$PKG" -C "$APP_DIR"
cd "$APP_DIR"

if [ -f "$ENV" ]; then
  cp "$ENV" .env
fi

echo "[deploy] Installing production dependencies"
npm ci --omit=dev || npm install --omit=dev

echo "[deploy] Starting app with PM2 (auto-migrations enabled)"
pm2 delete ibiki-sms || true
PM2_ENV="RUN_DB_MIGRATIONS=true NODE_ENV=production"
pm2 start dist/index.js --name ibiki-sms --env "$PM2_ENV"
pm2 save

echo "[health] local"
curl -sS -m 6 http://127.0.0.1:5000/api/health || true
echo "[health] public"
curl -sS -m 8 https://ibiki.run.place/api/health || true
