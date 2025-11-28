cat >/root/replace_nginx_ibiki.sh <<'EOF'
set -e
cp /etc/nginx/sites-enabled/ibiki-sms /etc/nginx/sites-enabled/ibiki-sms.bak.
cat >/etc/nginx/sites-enabled/ibiki-sms <<'CONF'
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
        try_files  =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    location / {
        try_files  / /index.html;
        add_header Cache-Control "no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade ;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host System.Management.Automation.Internal.Host.InternalHost;
        proxy_set_header X-Real-IP ;
        proxy_set_header X-Forwarded-For ;
        proxy_set_header X-Forwarded-Proto ;
    }
}

server {
    listen 80;
    server_name ibiki.run.place;
    return 301 https://System.Management.Automation.Internal.Host.InternalHost;
}
CONF

nginx -t && systemctl reload nginx && echo RELOADED
curl -I https://ibiki.run.place/admin | sed -n '1,20p'
ASSET=
curl -I "https://ibiki.run.place/assets/" | sed -n '1,20p'
EOF
