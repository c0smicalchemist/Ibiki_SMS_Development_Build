set -euo pipefail

CONF="/etc/nginx/sites-available/ibiki-clean"

if ! grep -q 'Strict-Transport-Security' "$CONF"; then
  sed -i '/add_header Cache-Control "no-store, must-revalidate" always;/a\    add_header Strict-Transport-Security "max-age=31536000" always;' "$CONF"
fi

nginx -t
systemctl reload nginx
echo HSTS_OK
