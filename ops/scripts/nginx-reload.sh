set -euo pipefail
nginx -t
systemctl reload nginx
echo NGINX_RELOADED
