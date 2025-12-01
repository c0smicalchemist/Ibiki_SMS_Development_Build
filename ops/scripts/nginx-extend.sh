set -euo pipefail

CONF="/etc/nginx/sites-available/ibiki-clean"

add_block() {
  cat >> "$CONF" <<'EOF'
server {
    listen 80;
    server_name www.ibiki.run.place;
    return 301 https://ibiki.run.place$request_uri;
}
EOF
}

add_ip_block() {
  cat >> "$CONF" <<'EOF'
server {
    listen 80;
    server_name 151.243.109.79;
    return 301 https://$host$request_uri;
}
EOF
}

grep -q "server_name www.ibiki.run.place" "$CONF" || add_block
grep -q "server_name 151.243.109.79" "$CONF" || add_ip_block

nginx -t
systemctl reload nginx
echo NGINX_EXTEND_OK
