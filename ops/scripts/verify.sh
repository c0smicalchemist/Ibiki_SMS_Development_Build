set -euo pipefail

echo "== redirect check (domain) =="
curl -Is http://ibiki.run.place/admin | sed -n '1,5p'

echo "== redirect check (ip) =="
curl -Is http://151.243.109.79/admin | sed -n '1,5p'

echo "== api health =="
curl -s https://ibiki.run.place/api/test || true

echo "== webhook POST sample =="
curl -s -X POST https://ibiki.run.place/api/webhook/extreme-sms \
  -H 'Content-Type: application/json' \
  -d '{"from":"+15551234567","receiver":"+15557654321","message":"hello","business":"acme"}' | sed -n '1,5p'
