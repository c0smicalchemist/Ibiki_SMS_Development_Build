#!/usr/bin/env bash
set -euo pipefail

echo "== Frontend HTML =="
curl -s https://ibiki.run.place | head -n 5 || true
echo

echo "== Asset MIME =="
echo "CSS:"; curl -I https://ibiki.run.place/assets/index-*.css 2>/dev/null | grep -i '^content-type' | head -1 || true
echo "JS:"; curl -I https://ibiki.run.place/assets/index-*.js 2>/dev/null | grep -i '^content-type' | head -1 || true
echo

echo "== API Health =="
curl -s https://ibiki.run.place/api/health || true
echo

echo "== Webhook Test =="
curl -s -X POST https://ibiki.run.place/api/webhook/extreme-sms \
  -H 'Content-Type: application/json' \
  -d '{"from":"+15550001111","to":"IBS_test","message":"Verify","messageId":"verify-001"}' || true
echo

echo "== Inbox =="
curl -s https://ibiki.run.place/api/web/inbox | head -n 1 || true
echo

echo "Done"

