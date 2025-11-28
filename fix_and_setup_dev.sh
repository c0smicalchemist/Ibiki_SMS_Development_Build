#!/bin/bash
set -e
# 1) Fix role update URL in AdminDashboard.tsx
python3 - <<'PY'
import re
p='/opt/ibiki-sms/client/src/pages/AdminDashboard.tsx'
s=open(p,'r',encoding='utf-8').read()
s_new=re.sub(r'apiRequest\(/api/admin/users//role', 'apiRequest(`\/api\/admin\/users/${client.id}/role', s)
if s_new!=s:
    open(p,'w',encoding='utf-8').write(s_new)
    print('ADMIN PATCHED')
else:
    print('ADMIN NOCHANGE')
PY
# 2) Rebuild and restart production
cd /opt/ibiki-sms
npm run build || exit 1
pm2 restart ibiki-sms --update-env
# 3) Setup dev copy
rm -rf /opt/ibiki-sms-dev || true
cp -a /opt/ibiki-sms /opt/ibiki-sms-dev
cd /opt/ibiki-sms-dev
npm run build || exit 1
PORT=5001 pm2 start dist/index.js --name ibiki-sms-dev || pm2 restart ibiki-sms-dev --update-env
# 4) Nginx site for dev (HTTP only for now)
DEVCONF=/etc/nginx/sites-available/ibiki-dev
cat > "$DEVCONF" <<'CONF'
server {
    listen 80;
    server_name dev.ibiki.run.place;
    root /opt/ibiki-sms-dev/dist/public;
    index index.html;
    add_header Cache-Control "no-store, must-revalidate" always;
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires -1;
        etag off;
        add_header Cache-Control "no-store, must-revalidate" always;
        try_files $uri =404;
    }
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, must-revalidate";
    }
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
CONF
ln -sf "$DEVCONF" /etc/nginx/sites-enabled/ibiki-dev
nginx -t && systemctl reload nginx
# 5) Output guidance
IP=$(curl -s ifconfig.me || echo 151.243.109.79)
echo "SERVER_IP=$IP"
echo "Add DNS A record: dev.ibiki.run.place -> $IP , then request TLS: certbot --nginx -d dev.ibiki.run.place"
