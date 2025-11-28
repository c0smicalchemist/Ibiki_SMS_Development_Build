#!/bin/bash
set -e
USER_ID="$1"
ROLE="${2:-client}"
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ibiki_dash@proton.me", "password":"c0smic4382"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -o /dev/null -w 'HTTP %{http_code}\n' --max-time 4 -X POST "http://127.0.0.1:5000/api/admin/users/$USER_ID/role?token=$TOKEN" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"role\":\"$ROLE\"}"