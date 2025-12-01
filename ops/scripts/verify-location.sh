set -euo pipefail

echo "== domain Location =="
curl -Is http://ibiki.run.place/admin | grep -i Location || true

echo "== ip Location =="
curl -Is http://151.243.109.79/admin | grep -i Location || true
