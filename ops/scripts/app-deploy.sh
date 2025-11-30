set -euo pipefail
cd /opt/ibiki-sms
git fetch origin Ibiki_Production_Final
git checkout -B Ibiki_Production_Final origin/Ibiki_Production_Final
npm ci
npm run build
# Ensure database is attached and env applied before restart
if [ -x /root/db-ensure.sh ]; then
  bash /root/db-ensure.sh || true
fi
if [ -x /root/set-db-url.sh ]; then
  bash /root/set-db-url.sh || true
fi
pm2 restart ibiki-sms --update-env
echo APP_DEPLOY_OK
