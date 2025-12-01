set -euo pipefail

ts=$(date +%Y%m%d-%H%M)

# Backup Nginx config
cp /etc/nginx/sites-available/ibiki-sms.conf /etc/nginx/sites-available/ibiki-sms.conf.bak-$ts

# Preserve host on HTTP->HTTPS redirect
sed -i 's#return 301 https://ibiki.run.place\$request_uri;#return 301 https://\$host\$request_uri;#' /etc/nginx/sites-available/ibiki-sms.conf

# Add no-store caching for HTML shell if missing
if ! grep -q 'no-store' /etc/nginx/sites-available/ibiki-sms.conf; then
  sed -i '/location \/ {/{a\    expires -1;\n    add_header Cache-Control "no-store, must-revalidate";\n}' /etc/nginx/sites-available/ibiki-sms.conf
fi

# Reload Nginx
nginx -t
systemctl reload nginx

# Deploy application
cd /opt/ibiki-sms
git fetch origin Ibiki_Production_Final
git checkout -B Ibiki_Production_Final origin/Ibiki_Production_Final
npm ci
npm run build
pm2 restart ibiki-sms --update-env

echo DEPLOY_OK
