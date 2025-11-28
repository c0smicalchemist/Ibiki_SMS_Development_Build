#!/bin/bash
set -e
cd /opt/ibiki-sms
# Wire remote and fetch
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git
else
  git remote add origin https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git
fi
git fetch origin Ibiki_Production_Final
# Preserve local changes; switch branch
git stash push --include-untracked -m "pre-branch-switch $(date +%F-%T)" || true
git checkout -B Ibiki_Production_Final origin/Ibiki_Production_Final
# Build and restart
npm ci --omit=dev || true
npm run build || { echo BUILD_FAILED; exit 1; }
pm2 restart ibiki-sms --update-env || { echo PM2_FAILED; exit 1; }
# Summary
echo DEPLOY_OK
HEAD=$(git rev-parse --short HEAD)
echo HEAD=$HEAD
ls -la dist/public/assets | sed -n '1,20p'
