CONF=/etc/nginx/sites-enabled/ibiki-sms
set -e
cp "$CONF" "$CONF.bak"
# Fix escaped quotes in add_header
sed -i 's/add_header Cache-Control \"no-store, must-revalidate\" always;/add_header Cache-Control "no-store, must-revalidate" always;/g' "$CONF"
# Fix malformed try_files
sed -i 's/try_files[[:space:]]*\/[[:space:]]*@app;/try_files $uri =404;/g' "$CONF"
# Disable long-cache for static assets
sed -i 's/expires 1y;/expires -1;/g' "$CONF"
sed -i 's/add_header Cache-Control "public, immutable, max-age=31536000"/add_header Cache-Control "no-store, must-revalidate" always/g' "$CONF"
# Ensure SPA route sets no-store
sed -i "/location \/ {/,/}/ { /try_files/ a\\    add_header Cache-Control \"no-store, must-revalidate\"; }" "$CONF"
nginx -t && systemctl reload nginx && echo RELOADED || (echo NGINX_TEST_FAILED; exit 1)
# Verify headers
curl -I https://ibiki.run.place/admin | sed -n '1,20p'
