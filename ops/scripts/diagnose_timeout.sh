set -euo pipefail
echo ==== nginx_active ====
systemctl is-active nginx || true
echo ==== ports ====
ss -tulpn | grep -E ':(80|443) ' || true
echo ==== curl domain ====
timeout 8 curl -Is https://ibiki.run.place/ | head -n 1 || true
echo ==== curl ip ====
timeout 8 curl -Is https://151.243.109.79/ | head -n 1 || true
echo ==== curl api ====
timeout 8 curl -s https://ibiki.run.place/api/test || true
echo ==== cert_expiry ====
openssl x509 -in /etc/letsencrypt/live/ibiki.run.place/fullchain.pem -noout -enddate || true
echo ==== dns ====
getent hosts ibiki.run.place || true
echo ==== ufw ====
ufw status || true
echo ==== nginx_error_tail ====
tail -n 80 /var/log/nginx/error.log || true
