NEW=/etc/nginx/sites-available/ibiki-clean
ENABLED=/etc/nginx/sites-enabled/ibiki-sms
BACKUP=/etc/nginx/sites-enabled/ibiki-sms.bak
set -e
[ -f "$ENABLED" ] && cp "$ENABLED" "$BACKUP"
cat > "$NEW" <<'CONF'
server {
    listen 443 ssl;
    server_name ibiki.run.place;

    add_header Cache-Control "no-store, must-revalidate" always;

    ssl_certificate /etc/letsencrypt/live/ibiki.run.place-0001/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ibiki.run.place-0001/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /opt/ibiki-sms/dist/public;
    index index.html;

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
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ibiki.run.place;
    return 301 https://$host$request_uri;
}
CONF

ln -sf "$NEW" "$ENABLED"
nginx -t && systemctl reload nginx
# Verify headers
curl -I https://ibiki.run.place/admin | sed -n '1,20p'
ASSET=$(ls -1 /opt/ibiki-sms/dist/public/assets/*.js | head -n1)
curl -I "https://ibiki.run.place/assets/$(basename $ASSET)" | sed -n '1,20p'
