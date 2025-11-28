CONF=/etc/nginx/sites-enabled/ibiki-sms
set -e
cp "$CONF" "$CONF.bak.$(date +%s)"
# Normalize escaped quotes in add_header
sed -i 's/add_header Cache-Control \"no-store, must-revalidate\" always;/add_header Cache-Control "no-store, must-revalidate" always;/g' "$CONF"
# Fix malformed try_files
sed -i 's/try_files[[:space:]]*\/[[:space:]]*@app;/try_files $uri =404;/g' "$CONF"
# Convert long-cache assets block to no-store
sed -i '/location ~\* \.(js\|css\|png\|jpg\|jpeg\|gif\|ico\|svg\|woff\|woff2\|ttf\|eot)\$ {/,/}/ {\
 s/expires 1y;/expires -1;/;\
 s/add_header Cache-Control \"public, immutable, max-age=31536000\"/add_header Cache-Control \"no-store, must-revalidate\" always/;\
}' "$CONF"
nginx -t && systemctl reload nginx && echo RELOADED || (echo NGINX_TEST_FAILED; exit 1)
# Verify headers
curl -I https://ibiki.run.place/admin | sed -n '1,20p'
ASSET=$(ls -1 /opt/ibiki-sms/dist/public/assets/*.js | head -n1 | xargs -I{} basename {})
curl -I "https://ibiki.run.place/assets/$ASSET" | sed -n '1,20p'
