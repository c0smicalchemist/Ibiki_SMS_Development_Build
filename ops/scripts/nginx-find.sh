set -euo pipefail

echo "== search root directive =="
grep -R "root /opt/ibiki-sms/dist/public" /etc/nginx -n || true

echo "== search server_name ibiki.run.place =="
grep -R "server_name ibiki.run.place" /etc/nginx -n || true

echo "== list sites-available =="
ls -l /etc/nginx/sites-available || true

echo "== list sites-enabled =="
ls -l /etc/nginx/sites-enabled || true

echo "== list conf.d =="
ls -l /etc/nginx/conf.d || true
