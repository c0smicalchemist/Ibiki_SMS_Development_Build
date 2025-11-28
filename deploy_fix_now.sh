#!/bin/bash
set -e
cd /opt/ibiki-sms
REMOTE_URL="https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi
# Update code
git fetch origin Ibiki_Production_Final || true
# Try fast-forward, else stash and switch
if ! git merge --ff-only origin/Ibiki_Production_Final; then
  git stash push --include-untracked -m "auto-stash-$(date +%F-%T)" || true
  git checkout -B Ibiki_Production_Final origin/Ibiki_Production_Final
fi
# Clean temp build folders
rm -rf node_modules/.vite-temp dist || true
# Install & build
npm ci
npm run build || { echo BUILD_FAILED; exit 1; }
pm2 restart ibiki-sms --update-env || { echo PM2_FAILED; exit 1; }
HEAD=$(git rev-parse --short HEAD); echo HEAD=$HEAD
# Verify APIs
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ibiki_dash@proton.me","password":"c0smic4382"}' | sed -n 's/.*"token":"\([^"\]*\)".*/\1/p'); echo TOKEN_LEN=${#TOKEN}
# Print status codes
curl -s -o /dev/null -w 'CLIENTS_HTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/clients
curl -s -o /dev/null -w 'BALANCE_HTTP %{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/extremesms-balance
# Show brief payload heads
echo CLIENTS_HEAD:
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/clients | sed -n '1,5p'
echo BALANCE_HEAD:
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5000/api/admin/extremesms-balance | sed -n '1,5p'
# Show pm2 env critical vars
pm2 env 0 | grep -E 'DATABASE_URL|PORT' || true
echo READY
