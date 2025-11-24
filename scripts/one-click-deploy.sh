#!/usr/bin/env bash
set -e

# Config
SERVER="root@151.243.109.79"     # target server
SERVER_ENV="/root/.env.production" # env file path on server (uploaded)
LOCAL_ENV=".env.production"        # local env file to upload
APP_DIR="/opt/ibiki-sms"           # app dir on server

echo "[local] Building and packaging"
bash scripts/build-package.sh
PKG=$(ls -1t release/ibiki-sms-*.tar.gz | head -n1)
echo "[local] Package: $PKG"

echo "[local] Uploading package and env to server"
scp "$PKG" "$SERVER:/root/"
scp "$LOCAL_ENV" "$SERVER:$SERVER_ENV"

echo "[remote] Deploying"
ssh "$SERVER" "bash -lc 'bash $APP_DIR/scripts/server-deploy.sh /root/$(basename "$PKG") $SERVER_ENV || (mkdir -p $APP_DIR/scripts && cp /root/$(basename "$PKG") $APP_DIR/ && tar -xzf $APP_DIR/$(basename "$PKG") -C $APP_DIR && bash $APP_DIR/scripts/server-deploy.sh /root/$(basename "$PKG") $SERVER_ENV)'"

echo "[done] Deployment completed. App managed by PM2 (ibiki-sms)."
