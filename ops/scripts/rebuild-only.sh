#!/usr/bin/env bash
set -e
cd /opt/ibiki-sms
npm ci
npm run build
pm2 restart ibiki-sms --update-env
echo REBUILD_OK
