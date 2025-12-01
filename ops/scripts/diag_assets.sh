set -euo pipefail
echo ==== files ====
ls -lh /opt/ibiki-sms/dist/public/assets/index-CaUZK9dU.js || true
ls -lh /opt/ibiki-sms/dist/public/assets/index-Bojz-Mbi.css || true
echo ==== curl local http ====
curl -Is http://127.0.0.1/assets/index-CaUZK9dU.js | head -n 1 || true
curl -Is http://127.0.0.1/assets/index-Bojz-Mbi.css | head -n 1 || true
echo ==== curl https domain ====
timeout 6 curl -Is https://ibiki.run.place/assets/index-CaUZK9dU.js | head -n 1 || true
timeout 6 curl -Is https://ibiki.run.place/favicon.png | head -n 1 || true
echo ==== nginx access tail ====
tail -n 200 /var/log/nginx/access.log | grep -E "index-CaUZK9dU|favicon\.png" | tail -n 40 || true
echo ==== nginx error tail ====
tail -n 80 /var/log/nginx/error.log || true
